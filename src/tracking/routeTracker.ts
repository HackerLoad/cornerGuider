import { snapToPolyline } from '../geo/linearRef';
import { cumulativeLengths } from '../geo/polyline';
import { makeProjection, type Projection } from '../geo/projection';
import type { XY } from '../geo/types';
import type { Curve } from '../curves';

export interface Fix {
  lat: number;
  lon: number;
  /** m/s, null wenn unbekannt */
  speed: number | null;
  /** Genauigkeit in m, null wenn unbekannt */
  accuracy: number | null;
  /** Zeitstempel der Messung (ms, epoch) */
  timestamp: number;
  /** Fahrtrichtung in Grad (0 = Nord), falls vom GPS geliefert */
  heading?: number | null;
}

export interface TrackerRoute {
  path: XY[];
  projectionOrigin: { lat: number; lon: number };
  curves: Curve[];
}

export interface TrackerConfig {
  /** Abstand zur Route, ab dem eine Abweichung gezählt wird (m) */
  offRouteDistanceM: number;
  /** So lange muss die Abweichung anhalten (ms) */
  offRouteDurationMs: number;
  /** Fixes mit schlechterer Genauigkeit werden ignoriert (m) */
  maxAccuracyM: number;
  /** Höchstens so viel Latenz wird per Extrapolation ausgeglichen (ms) */
  maxLatencyMs: number;
  /** Suchfenster vorwärts: mindestens (m) und Sekunden × Geschwindigkeit */
  searchAheadMinM: number;
  searchAheadSeconds: number;
  /** Ab dieser Restdistanz zum Ende gilt die Route als beendet (m) */
  finishDistanceM: number;
  /** Beim Wiedereinstieg darf höchstens so weit zurückgesprungen werden (m) */
  rejoinBackM: number;
}

export const DEFAULT_TRACKER_CONFIG: TrackerConfig = {
  offRouteDistanceM: 50,
  offRouteDurationMs: 5000,
  maxAccuracyM: 100,
  maxLatencyMs: 3000,
  searchAheadMinM: 200,
  searchAheadSeconds: 10,
  finishDistanceM: 20,
  rejoinBackM: 50,
};

export type TrackStatus = 'acquiring' | 'onRoute' | 'offRoute' | 'finished';

export interface TrackState {
  status: TrackStatus;
  /** Position entlang der Route inkl. Latenzausgleich (m) */
  dist: number;
  /** Seitlicher Abstand zur Route (m) */
  offset: number;
  /** m/s (0 wenn unbekannt) */
  speed: number;
}

/** Snappt GPS-Fixes auf die Route, verhindert Rückwärtssprünge und erkennt Off-Route. */
export class RouteTracker {
  private readonly proj: Projection;
  private readonly cum: number[];
  private readonly cfg: TrackerConfig;
  readonly length: number;

  private lastDist: number | null = null;
  private offSince: number | null = null;
  private state: TrackState = { status: 'acquiring', dist: 0, offset: 0, speed: 0 };

  constructor(private readonly route: TrackerRoute, config: Partial<TrackerConfig> = {}) {
    this.cfg = { ...DEFAULT_TRACKER_CONFIG, ...config };
    this.proj = makeProjection(route.projectionOrigin);
    this.cum = cumulativeLengths(route.path);
    this.length = this.cum[this.cum.length - 1] ?? 0;
  }

  get current(): TrackState {
    return this.state;
  }

  reset(): void {
    this.lastDist = null;
    this.offSince = null;
    this.state = { status: 'acquiring', dist: 0, offset: 0, speed: 0 };
  }

  /** `now` = aktueller Zeitpunkt (ms), für die Latenzkompensation. */
  update(fix: Fix, now: number = Date.now()): TrackState {
    if (fix.accuracy !== null && fix.accuracy > this.cfg.maxAccuracyM) return this.state;

    const speed = Math.max(0, fix.speed ?? 0);
    const xy = this.proj.toXY(fix);
    const last = this.lastDist;
    const offRoute = this.state.status === 'offRoute';

    let snap;
    if (last === null) {
      snap = snapToPolyline(xy, this.route.path, this.cum);
    } else if (offRoute) {
      snap = snapToPolyline(xy, this.route.path, this.cum, { minDist: last - this.cfg.rejoinBackM });
    } else {
      const ahead = Math.max(this.cfg.searchAheadMinM, speed * this.cfg.searchAheadSeconds);
      snap = snapToPolyline(xy, this.route.path, this.cum, { minDist: last - 30, maxDist: last + ahead });
    }

    if (snap.offset > this.cfg.offRouteDistanceM) {
      this.offSince ??= fix.timestamp;
      if (fix.timestamp - this.offSince >= this.cfg.offRouteDurationMs) {
        this.state = { ...this.state, status: 'offRoute', offset: snap.offset, speed };
      } else {
        this.state = { ...this.state, offset: snap.offset, speed };
      }
      return this.state;
    }
    this.offSince = null;

    // Nie rückwärts (GPS-Jitter), außer beim allerersten Fix
    const monotonic = last === null ? snap.dist : Math.max(last, snap.dist);
    this.lastDist = monotonic;

    // Latenz ausgleichen: seit der Messung zurückgelegte Strecke addieren
    const latency = Math.min(Math.max(0, now - fix.timestamp), this.cfg.maxLatencyMs);
    const dist = Math.min(this.length, monotonic + (speed * latency) / 1000);

    const finished = this.length - dist <= this.cfg.finishDistanceM;
    this.state = { status: finished ? 'finished' : 'onRoute', dist, offset: snap.offset, speed };
    return this.state;
  }
}
