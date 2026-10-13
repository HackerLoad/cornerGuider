import type { CurveConfig } from './config';
import type { Curve } from './types';

/** Markiert Kurven, die in weniger als sequenceGapM auf die vorherige folgen. */
export function markSequences(curves: Curve[], cfg: CurveConfig): void {
  curves.forEach((c, i) => {
    const prev = curves[i - 1];
    c.gapToPrevious = prev ? Math.max(0, c.startDist - prev.endDist) : null;
    c.followsPrevious = c.gapToPrevious !== null && c.gapToPrevious < cfg.sequenceGapM;
  });
}
