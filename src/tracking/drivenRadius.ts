import { signedCurvature } from '../curves/radius';
import type { XY } from '../geo/types';

/**
 * Radius der gerade gefahrenen Kurve aus den letzten Positionen (Umkreis durch drei Punkte, jeweils mindestens
 * `minSpacingM` auseinander). Gilt für die Stelle des mittleren Punkts, hinkt der Position also etwas hinterher.
 */
export class DrivenRadius {
  private trail: XY[] = [];

  constructor(
    private readonly minSpacingM = 8,
    private readonly maxRadiusM = 1000,
    private readonly keep = 30,
  ) {}

  reset(): void {
    this.trail = [];
  }

  /** Neue Position; liefert den Radius (m) oder null bei Gerade, Stand und zu wenig Verlauf. */
  push(p: XY): number | null {
    this.trail.push(p);
    if (this.trail.length > this.keep) this.trail.shift();
    const pick = (from: number, ref: XY): number => {
      for (let i = from; i >= 0; i--) {
        if (Math.hypot(this.trail[i]!.x - ref.x, this.trail[i]!.y - ref.y) >= this.minSpacingM) return i;
      }
      return -1;
    };
    const i1 = pick(this.trail.length - 2, p);
    if (i1 < 0) return null;
    const i0 = pick(i1 - 1, this.trail[i1]!);
    if (i0 < 0) return null;
    const k = Math.abs(signedCurvature(this.trail[i0]!, this.trail[i1]!, p));
    return k < 1 / this.maxRadiusM ? null : 1 / k;
  }
}
