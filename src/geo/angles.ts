import type { XY } from './types';

/** Richtung eines Vektors in Grad, 0 = Nord, 90 = Ost (x = Ost, y = Nord). */
export function bearing(from: XY, to: XY): number {
  const deg = (Math.atan2(to.x - from.x, to.y - from.y) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Kleinster Unterschied zweier Richtungen in Grad (0…180). */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}
