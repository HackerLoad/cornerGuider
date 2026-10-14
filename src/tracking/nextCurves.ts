import type { Curve } from '../curves';

export interface UpcomingCurve {
  curve: Curve;
  /** Distanz entlang der Route bis zum Kurvenanfang (m); 0 wenn man schon drin ist */
  distanceTo: number;
  inside: boolean;
  /** Wie weit der Fahrer schon in der Kurve ist (m, negativ = noch davor); falls bekannt */
  progressM?: number;
}

/** Die nächsten `count` Kurven ab Position `dist` (inkl. der aktuellen, falls man drin ist). */
export function nextCurves(curves: Curve[], dist: number, count: number): UpcomingCurve[] {
  const out: UpcomingCurve[] = [];
  for (const curve of curves) {
    if (curve.endDist <= dist) continue;
    out.push({ curve, distanceTo: Math.max(0, curve.startDist - dist), inside: curve.startDist <= dist });
    if (out.length >= count) break;
  }
  return out;
}
