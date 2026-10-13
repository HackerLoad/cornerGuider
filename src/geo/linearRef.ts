import type { XY } from './types';

export interface Snap {
  /** Distanz entlang der Route (m) */
  dist: number;
  /** Seitlicher Abstand zur Route (m) */
  offset: number;
  segIndex: number;
}

export interface SnapOptions {
  /** Nur Segmente im Bereich [minDist, maxDist] entlang der Route betrachten. */
  minDist?: number;
  maxDist?: number;
}

/** Projiziert p auf die nächste Stelle der Polyline (cum = kumulierte Längen). */
export function snapToPolyline(p: XY, pts: XY[], cum: number[], opts: SnapOptions = {}): Snap {
  const minD = opts.minDist ?? -Infinity;
  const maxD = opts.maxDist ?? Infinity;
  let best: Snap | null = null;
  for (let i = 0; i < pts.length - 1; i++) {
    if (cum[i + 1]! < minD) continue;
    if (cum[i]! > maxD) break;
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const offset = Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
    if (!best || offset < best.offset) {
      best = { dist: cum[i]! + t * Math.sqrt(len2), offset, segIndex: i };
    }
  }
  if (!best) throw new Error('snapToPolyline: no segment in range');
  return best;
}
