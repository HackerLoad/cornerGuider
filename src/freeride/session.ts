import type { LocationSource } from '../drive/locationSource';
import { dist } from '../geo/polyline';
import type { LatLon, XY } from '../geo/types';
import type { DriveSettings } from '../settings';
import { buildMark, type CurveRating, type FeedbackMark, type MarkKind } from '../feedback/model';
import type { Fix } from '../tracking/routeTracker';
import { announceSettingsFrom, leadDistance } from '../voice/announceScheduler';
import { systemPhrase } from '../voice/phrases';
import { FreeAnnouncer } from '../voice/freeAnnouncer';
import { FreerideEngine, type FreerideState } from './engine';
import { PreviewMonitor } from './previewMonitor';
import { fetchOverpass } from './overpassClient';
import { buildTileQuery, tileKey, tilesNear, type Tile } from './tiles';
import { RoadGraph } from './roadGraph';
import type { OsmWay } from './types';

export type DataStatus = 'loading' | 'ready' | 'error';

export interface FreerideSnapshot extends FreerideState {
  data: DataStatus;
  dataError?: string;
  /** Ursprünglicher Fehler (kann ein AppError sein, damit die Oberfläche ihn in ihrer Sprache zeigt) */
  dataErrorRaw?: unknown;
  /** Letzte gesprochene Ansage */
  lastSpoken?: string;
  /** m/s (0 wenn unbekannt) */
  speed: number;
  /** Ob die Vorschau gerade fehlt (Kreuzung, keine Daten, Straße unsicher) – nach Entprellung */
  previewLost: boolean;
}

export interface RecordedFix {
  t: number;
  lat: number;
  lon: number;
  speed: number | null;
}

export interface RecordedAnnouncement {
  t: number;
  text: string;
  curves: { start: XY; grade: number; direction: 'left' | 'right' }[];
}

export interface FreerideStats {
  steps: number;
  ok: number;
  uncertain: number;
  noRoad: number;
  loading: number;
  /** Wie der vorhergesagte Pfad endete (nur Schritte mit Straße) */
  endReasons: Record<string, number>;
}

/** Aufzeichnung einer Fahrt für die spätere Auswertung. */
export interface FreerideRecording {
  version: 1;
  id: string;
  startedAt: number;
  endedAt: number;
  /** Ursprung der lokalen Meter, in denen `announcements` angegeben sind */
  origin: LatLon;
  fixes: RecordedFix[];
  announcements: RecordedAnnouncement[];
  stats: FreerideStats;
  /** Bewertungen der angesagten Kurven nach der Fahrt (Schlüssel siehe feedback/model.ts) */
  ratings?: Record<string, CurveRating>;
}

export interface FreerideSessionOptions {
  source: LocationSource;
  speak: (text: string) => void;
  getSettings: () => DriveSettings;
  /** Straßendaten einer Kachel holen (Speicher und Netz); Standard: direkt von Overpass */
  loadTile?: (tile: Tile) => Promise<OsmWay[]>;
  now?: () => number;
  /** So weit voraus werden Kacheln schon geladen (m); eine zweite Marke liegt beim Doppelten */
  lookAheadM?: number;
  /** Wartezeit nach fehlgeschlagenem Abruf (ms), verdoppelt sich bis 60 s */
  retryMs?: number;
  /** Höchstens so viele Kacheln gleichzeitig laden */
  maxParallel?: number;
}

const initialSnapshot = (xy: XY): FreerideSnapshot => ({
  status: 'noRoad',
  riderXY: xy,
  heading: null,
  aheadM: 0,
  riderDist: 0,
  upcoming: [],
  data: 'loading',
  speed: 0,
  previewLost: false,
});

/** Freie Fahrt: Positionen → Straßendaten (OSM) laden → Kurven vorhersagen → ansagen → aufzeichnen. */
export class FreerideSession {
  private graph: RoadGraph | null = null;
  private engine: FreerideEngine | null = null;
  private readonly announcer = new FreeAnnouncer();
  private readonly preview = new PreviewMonitor();
  private readonly now: () => number;
  private listeners = new Set<(s: FreerideSnapshot) => void>();
  /** Zustand je Kachel: wartet, wird geladen oder ist da */
  private tileState = new Map<string, 'queued' | 'loading' | 'loaded'>();
  private queue: Tile[] = [];
  private active = 0;
  private refXY: XY | null = null;
  private lastHeading: number | null = null;
  private nextTryAt = 0;
  private failures = 0;
  private dataError: string | undefined;
  private dataErrorRaw: unknown;
  private lastSpoken: string | undefined;
  private running = false;
  private lastFix: Fix | null = null;
  private startedAt = 0;
  private readonly fixes: RecordedFix[] = [];
  private readonly announcements: RecordedAnnouncement[] = [];
  private readonly stats: FreerideStats = { steps: 0, ok: 0, uncertain: 0, noRoad: 0, loading: 0, endReasons: {} };

  snapshot: FreerideSnapshot = initialSnapshot({ x: 0, y: 0 });

  constructor(private readonly o: FreerideSessionOptions) {
    this.now = o.now ?? Date.now;
  }

  subscribe(cb: (s: FreerideSnapshot) => void): () => void {
    this.listeners.add(cb);
    cb(this.snapshot);
    return () => this.listeners.delete(cb);
  }

  async start(): Promise<void> {
    this.running = true;
    this.startedAt = this.now();
    await this.o.source.start((fix) => this.onFix(fix));
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.o.source.stop();
  }

  /** Markierung (falsch / fehlt) an der letzten Position; null, solange noch kein GPS vorliegt. */
  makeMark(kind: MarkKind): FeedbackMark | null {
    if (!this.lastFix) return null;
    const first = this.snapshot.status === 'ok' ? this.snapshot.upcoming[0] : undefined;
    return buildMark(kind, 'free', this.lastFix, {
      curve: first ? { direction: first.curve.direction, grade: first.curve.grade } : undefined,
    });
  }

  getRecording(): FreerideRecording | null {
    if (!this.graph) return null;
    return {
      version: 1,
      id: `${this.startedAt.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      startedAt: this.startedAt,
      endedAt: this.now(),
      origin: this.graph.projection.origin,
      fixes: this.fixes,
      announcements: this.announcements,
      stats: this.stats,
    };
  }

  onFix(fix: Fix): void {
    if (!this.running) return;
    if (!this.graph) {
      this.graph = new RoadGraph(fix);
      this.engine = new FreerideEngine(this.graph);
    }
    const graph = this.graph;
    const engine = this.engine!;
    this.lastFix = fix;
    const t = this.now();
    this.fixes.push({ t, lat: fix.lat, lon: fix.lon, speed: fix.speed });

    this.maybeLoad(fix, graph);
    const state = engine.update(fix);

    const settings = this.o.getSettings();
    this.announcer.setSettings(announceSettingsFrom(settings));
    const a = this.announcer.next(state.upcoming, fix.speed ?? 0, state.status === 'ok');
    if (a) {
      this.announcements.push({ t, text: a.text, curves: a.curves });
      this.lastSpoken = a.text;
      if (settings.voiceEnabled) this.o.speak(a.text);
    }

    // Stille darf nicht als „gerade" verstanden werden: Ausfall und Rückkehr der Vorschau je einmal melden
    const ev = this.preview.update({
      ok: state.status === 'ok',
      aheadM: state.aheadM,
      leadM: leadDistance(fix.speed ?? 0, announceSettingsFrom(settings)),
      speedMs: fix.speed ?? 0,
    });
    if (ev) {
      const text = systemPhrase(ev === 'lost' ? 'noPreview' : 'previewBack', settings.voiceLanguage);
      this.lastSpoken = text;
      if (settings.voiceEnabled) this.o.speak(text);
    }

    const data: DataStatus = this.dataStatus(fix);
    this.stats.steps++;
    if (data === 'loading' && state.status === 'noRoad') this.stats.loading++;
    else this.stats[state.status]++;
    if (state.endReason) this.stats.endReasons[state.endReason] = (this.stats.endReasons[state.endReason] ?? 0) + 1;

    this.emit({ ...state, data, dataError: this.dataError, dataErrorRaw: this.dataErrorRaw, lastSpoken: this.lastSpoken, speed: fix.speed ?? 0, previewLost: this.preview.lost });
  }

  private emit(s: FreerideSnapshot): void {
    this.snapshot = s;
    this.listeners.forEach((l) => l(s));
  }

  private dataStatus(here: LatLon): DataStatus {
    const t = tilesNear(here, 0)[0]!;
    if (this.tileState.get(tileKey(t)) === 'loaded') return 'ready';
    return this.failures > 0 && this.active === 0 ? 'error' : 'loading';
  }

  /** Fahrtrichtung: aus dem GPS, sonst aus der Bewegung der letzten Positionen. */
  private headingOf(fix: Fix, here: XY): number | null {
    if (fix.heading != null && (fix.speed ?? 0) >= 2) {
      this.lastHeading = fix.heading;
      return fix.heading;
    }
    if (!this.refXY) this.refXY = here;
    const dx = here.x - this.refXY.x;
    const dy = here.y - this.refXY.y;
    if (Math.hypot(dx, dy) >= 8) {
      this.lastHeading = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
      this.refXY = here;
    }
    return this.lastHeading;
  }

  /**
   * Sorgt dafür, dass die Kacheln rund um die Position und voraus geladen sind (oder gerade geladen werden).
   * Die Kachel unter der Position kommt zuerst; höchstens `maxParallel` Abrufe laufen gleichzeitig.
   */
  private maybeLoad(fix: Fix, graph: RoadGraph): void {
    const hereXY = graph.projection.toXY(fix);
    const heading = this.headingOf(fix, hereXY);
    const lookAhead = this.o.lookAheadM ?? 600;
    const want: Tile[] = tilesNear(fix, 300);
    if (heading !== null) {
      for (const [dist, margin] of [[lookAhead, 300], [lookAhead * 2, 200]] as const) {
        const p = graph.projection.toLatLon({
          x: hereXY.x + Math.sin((heading * Math.PI) / 180) * dist,
          y: hereXY.y + Math.cos((heading * Math.PI) / 180) * dist,
        });
        want.push(...tilesNear(p, margin));
      }
    }
    for (const t of want) {
      const key = tileKey(t);
      if (!this.tileState.has(key)) {
        this.tileState.set(key, 'queued');
        this.queue.push(t);
      }
    }
    this.pump(graph);
  }

  private pump(graph: RoadGraph): void {
    const max = this.o.maxParallel ?? 2;
    while (this.active < max && this.queue.length > 0 && this.now() >= this.nextTryAt) {
      const tile = this.queue.shift()!;
      const key = tileKey(tile);
      this.tileState.set(key, 'loading');
      this.active++;
      const load = this.o.loadTile ?? ((t: Tile) => fetchOverpass(buildTileQuery(t), { allowEmpty: true }));
      load(tile)
        .then((ways) => {
          graph.addWays(ways);
          this.tileState.set(key, 'loaded');
          this.failures = 0;
          this.dataError = undefined;
          this.dataErrorRaw = undefined;
        })
        .catch((e: unknown) => {
          this.tileState.delete(key); // wird beim nächsten Positionsupdate erneut angefordert
          this.failures++;
          this.dataError = e instanceof Error ? e.message : String(e);
          this.dataErrorRaw = e;
          this.nextTryAt = this.now() + Math.min(60_000, (this.o.retryMs ?? 10_000) * 2 ** (this.failures - 1));
        })
        .finally(() => {
          this.active--;
        });
    }
  }
}
