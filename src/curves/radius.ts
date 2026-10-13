import type { XY } from '../geo/types';

/**
 * Vorzeichenbehaftete Krümmung (1/m) des Umkreises durch a, b, c.
 * Positiv = Linkskurve (gegen den Uhrzeigersinn, x = Ost, y = Nord), 0 bei Gerade.
 */
export function signedCurvature(a: XY, b: XY, c: XY): number {
  const abx = b.x - a.x, aby = b.y - a.y;
  const bcx = c.x - b.x, bcy = c.y - b.y;
  const cax = a.x - c.x, cay = a.y - c.y;
  const cross = abx * bcy - aby * bcx;
  const lab = Math.hypot(abx, aby);
  const lbc = Math.hypot(bcx, bcy);
  const lca = Math.hypot(cax, cay);
  const denom = lab * lbc * lca;
  if (denom === 0) return 0;
  return (2 * cross) / denom;
}
