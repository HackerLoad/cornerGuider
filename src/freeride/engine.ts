import { bearing } from '../geo/angles';
import { snapToPolyline } from '../geo/linearRef';
import type { XY } from '../geo/types';
import { detectCurvesXY } from '../curves';
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
export class FreerideEngine {
  private prev: Match | null = null;
  private trail: XY[] = [];

  constructor(
    readonly graph: RoadGraph,
    private readonly cfg: EngineConfig = DEFAULT_ENGINE_CONFIG,
  ) {}

  reset(): void {
    this.prev = null;
    this.trail = [];
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
      upcoming = nextCurves(complete, riderDist, this.cfg.upcomingCount);
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
