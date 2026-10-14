import type { LocationSource } from '../drive/locationSource';
import { dist } from '../geo/polyline';
import type { LatLon, XY } from '../geo/types';
import type { DriveSettings } from '../settings';
import type { Fix } from '../tracking/routeTracker';
import { FreeAnnouncer } from '../voice/freeAnnouncer';
import { FreerideEngine, type FreerideState } from './engine';
import { fetchRoads as defaultFetchRoads } from './overpassClient';
import { RoadGraph } from './roadGraph';
import type { OsmWay } from './types';

export type DataStatus = 'loading' | 'ready' | 'error';

export interface FreerideSnapshot extends FreerideState {
  data: DataStatus;
  dataError?: string;
  /** Letzte gesprochene Ansage */
  lastSpoken?: string;
  /** m/s (0 wenn unbekannt) */
  speed: number;
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
}

export interface FreerideSessionOptions {
  source: LocationSource;
  speak: (text: string) => void;
  getSettings: () => DriveSettings;
  fetchRoads?: (center: LatLon, radiusM: number) => Promise<OsmWay[]>;
  now?: () => number;
  /** Radius eines Datenabrufs (m) */
  loadRadiusM?: number;
  /** So weit voraus muss bereits geladen sein (m) */
  lookAheadM?: number;
  /** Wartezeit nach fehlgeschlagenem Abruf (ms), verdoppelt sich bis 60 s */
  retryMs?: number;
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
});

/** Freie Fahrt: Positionen → Straßendaten (OSM) laden → Kurven vorhersagen → ansagen → aufzeichnen. */
export class FreerideSession {
  private graph: RoadGraph | null = null;
  private engine: FreerideEngine | null = null;
  private readonly announcer = new FreeAnnouncer();
  private readonly now: () => number;
  private listeners = new Set<(s: FreerideSnapshot) => void>();
  private loaded: { center: XY; radius: number }[] = [];
  private inflight = false;
  private nextTryAt = 0;
  private failures = 0;
  private dataError: string | undefined;
  private lastSpoken: string | undefined;
  private running = false;
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
    const t = this.now();
    this.fixes.push({ t, lat: fix.lat, lon: fix.lon, speed: fix.speed });

    this.maybeLoad(fix, graph);
    const state = engine.update(fix);

    const settings = this.o.getSettings();
    this.announcer.setSettings({ leadSeconds: settings.leadSeconds, minLeadM: settings.minLeadM, minUsefulM: 30 });
    const a = this.announcer.next(state.upcoming, fix.speed ?? 0, state.status === 'ok');
    if (a) {
      this.announcements.push({ t, text: a.text, curves: a.curves });
      this.lastSpoken = a.text;
      if (settings.voiceEnabled) this.o.speak(a.text);
    }

    const data: DataStatus = this.dataStatus(state.riderXY);
    this.stats.steps++;
    if (data === 'loading' && state.status === 'noRoad') this.stats.loading++;
    else this.stats[state.status]++;
    if (state.endReason) this.stats.endReasons[state.endReason] = (this.stats.endReasons[state.endReason] ?? 0) + 1;

    this.emit({ ...state, data, dataError: this.dataError, lastSpoken: this.lastSpoken, speed: fix.speed ?? 0 });
  }

  private emit(s: FreerideSnapshot): void {
    this.snapshot = s;
    this.listeners.forEach((l) => l(s));
  }

  private covers(p: XY): boolean {
    return this.loaded.some((c) => dist(c.center, p) <= c.radius * 0.85);
  }

  private dataStatus(here: XY): DataStatus {
    if (this.covers(here)) return 'ready';
    return this.failures > 0 && !this.inflight ? 'error' : 'loading';
  }

  /** Lädt Straßendaten rund um die Position und voraus, bevor sie gebraucht werden. */
  private maybeLoad(fix: Fix, graph: RoadGraph): void {
    if (this.inflight || this.now() < this.nextTryAt) return;
    const here = graph.projection.toXY(fix);
    const lookAhead = this.o.lookAheadM ?? 600;
    const ahead: XY | null =
      fix.heading != null && (fix.speed ?? 0) >= 2
        ? {
            x: here.x + Math.sin((fix.heading * Math.PI) / 180) * lookAhead,
            y: here.y + Math.cos((fix.heading * Math.PI) / 180) * lookAhead,
          }
        : null;
    const needHere = !this.covers(here);
    const needAhead = ahead !== null && !this.covers(ahead);
    if (!needHere && !needAhead) return;

    const radius = this.o.loadRadiusM ?? 1500;
    const center = needHere || !ahead ? here : ahead;
    this.inflight = true;
    const doFetch = this.o.fetchRoads ?? ((c, r) => defaultFetchRoads(c, r));
    doFetch(graph.projection.toLatLon(center), radius)
      .then((ways) => {
        graph.addWays(ways);
        this.loaded.push({ center, radius });
        this.failures = 0;
        this.dataError = undefined;
      })
      .catch((e: unknown) => {
        this.failures++;
        this.dataError = e instanceof Error ? e.message : String(e);
        this.nextTryAt = this.now() + Math.min(60_000, (this.o.retryMs ?? 10_000) * 2 ** (this.failures - 1));
      })
      .finally(() => {
        this.inflight = false;
      });
  }
}
