import { bearing } from '../geo/angles';
import { snapToPolyline } from '../geo/linearRef';
import type { XY } from '../geo/types';
import { detectCurvesXY } from '../curves';
import { dist } from '../geo/polyline';
import { DEFAULT_CURVE_CONFIG } from '../curves/config';
import type { Curve } from '../curves';
import { nextCurves, type UpcomingCurve } from '../tracking/nextCurves';
import type { Fix } from '../tracking/routeTracker';
import { matchPosition, type Match } from './mapMatch';
import { DEFAULT_PATH_CONFIG, predictPath, type EndReason, type PathConfig } from './predictPath';
import type { RoadGraph } from './roadGraph';

export type FreerideStatus = 'noRoad' | 'ok' | 'uncertain';

export interface FreerideState {
  status: FreerideStatus;
  /** Position in den lokalen Metern des Straßengraphen */
  riderXY: XY;
  heading: number | null;
  wayName?: string;
  wayRef?: string;
  endReason?: EndReason;
  /** Länge des vorhergesagten Pfads ab der Position (m) */
  aheadM: number;
  /** Position auf dem vorhergesagten Pfad; `curve.startDist` der Kurven liegt in derselben Koordinate (m) */
  riderDist: number;
  upcoming: UpcomingCurve[];
}

export interface EngineConfig {
  path: PathConfig;
  /** Fahrtrichtung aus dem GPS nur ab dieser Geschwindigkeit verwenden (m/s) */
  minHeadingSpeed: number;
  /** Eine Kurve, die so nah am Pfadende liegt, ist unvollständig und wird nicht gemeldet (m) */
  truncatedWithinM: number;
  upcomingCount: number;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  path: DEFAULT_PATH_CONFIG,
  minHeadingSpeed: 2,
  truncatedWithinM: 15,
  upcomingCount: 5,
};

/** Sagt aus Position und Straßendaten die kommenden Kurven voraus (ohne geplante Route). */
/** Zwei Erkennungen gelten als dieselbe Kurve, wenn Anfang oder Ende so nah beieinander liegen (m). */
const SAME_CURVE_M = 25;
/** Gemerkte Kurven weiter als dies vom Fahrer entfernt werden vergessen (m). */
const FORGET_BEYOND_M = 1500;

export class FreerideEngine {
  private prev: Match | null = null;
  private trail: XY[] = [];
  /**
   * Gemerkte Darstellung jeder Kurve. Der Pfad wird jede Sekunde neu berechnet (anderer Anfang, anderes
   * 5-m-Raster), dadurch schwankten Radius, Stufe und Form leicht. Die erste vollständige Darstellung
   * (mit Vor- und Nachlauf) wird deshalb festgehalten.
   */
  private known: Curve[] = [];

  constructor(
    readonly graph: RoadGraph,
    private readonly cfg: EngineConfig = DEFAULT_ENGINE_CONFIG,
  ) {}

  reset(): void {
    this.prev = null;
    this.trail = [];
    this.known = [];
  }

  private isFull(c: Curve): boolean {
    const margin = Math.round(DEFAULT_CURVE_CONFIG.geometryMarginM / DEFAULT_CURVE_CONFIG.resampleStepM);
    return c.geometryCurveStart >= margin && c.geometry.length - 1 - c.geometryCurveEnd >= margin;
  }

  /** Liefert die festgehaltene Darstellung dieser Kurve (oder merkt sie sich). */
  private stabilize(fresh: Curve): Curve {
    const i = this.known.findIndex(
      (k) =>
        k.direction === fresh.direction &&
        (dist(k.startXY, fresh.startXY) <= SAME_CURVE_M || dist(k.endXY, fresh.endXY) <= SAME_CURVE_M),
    );
    if (i < 0) {
      this.known.push(fresh);
      return fresh;
    }
    const kept = this.known[i]!;
    if (!this.isFull(kept) && this.isFull(fresh)) {
      this.known[i] = fresh;
      return fresh;
    }
    return kept;
  }

  private forgetFar(rider: XY): void {
    if (this.known.length > 30) this.known = this.known.filter((k) => dist(k.startXY, rider) <= FORGET_BEYOND_M);
  }

  private headingOf(fix: Fix, xy: XY): number | null {
    this.trail.push(xy);
    if (this.trail.length > 30) this.trail.shift();
    const speed = fix.speed ?? 0;
    if (fix.heading != null && speed >= this.cfg.minHeadingSpeed) return fix.heading;
    // aus der Bewegung der letzten Positionen ableiten
    for (let i = this.trail.length - 2; i >= 0; i--) {
      const p = this.trail[i]!;
      if (Math.hypot(xy.x - p.x, xy.y - p.y) >= 8) return bearing(p, xy);
    }
    return null;
  }

  update(fix: Fix): FreerideState {
    const xy = this.graph.projection.toXY(fix);
    const heading = this.headingOf(fix, xy);
    const match = matchPosition(this.graph, xy, heading, this.prev);
    this.prev = match;
    if (!match) return { status: 'noRoad', riderXY: xy, heading, aheadM: 0, riderDist: 0, upcoming: [] };

    const path = predictPath(this.graph, match, this.cfg.path);
    let upcoming: UpcomingCurve[] = [];
    let riderDist = path.positionDist;
    if (path.pts.length >= 3) {
      const det = detectCurvesXY(path.pts, this.graph.projection.origin);
      riderDist = snapToPolyline(match.point, det.path, det.dist).dist;
      const complete = det.curves.filter((c) => c.endDist < det.length - this.cfg.truncatedWithinM);
      this.forgetFar(match.point);
      upcoming = nextCurves(complete, riderDist, this.cfg.upcomingCount).map((u) => {
        // Darstellung festhalten, Entfernungen aber aus dem aktuellen Pfad bestimmen
        const curve = this.stabilize(u.curve);
        const s0 = snapToPolyline(curve.startXY, det.path, det.dist).dist;
        return { curve, distanceTo: Math.max(0, s0 - riderDist), inside: s0 <= riderDist, progressM: riderDist - s0 };
      });
    }
    return {
      status: match.confident ? 'ok' : 'uncertain',
      riderXY: match.point,
      heading,
      wayName: path.wayName,
      wayRef: path.wayRef,
      endReason: path.endReason,
      aheadM: path.ahead,
      riderDist,
      upcoming,
    };
  }
}
