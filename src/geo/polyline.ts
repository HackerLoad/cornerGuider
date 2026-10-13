import type { XY } from './types';

export function dist(a: XY, b: XY): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Kumulierte Länge entlang der Polyline (cum[0] = 0). */
export function cumulativeLengths(pts: XY[]): number[] {
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + dist(pts[i - 1]!, pts[i]!));
  return cum;
}

/** Entfernt aufeinanderfolgende (fast) identische Punkte. */
export function dedupe(pts: XY[], minDist = 0.5): XY[] {
  const out: XY[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || dist(last, p) >= minDist) out.push(p);
  }
  return out;
}

/** Resampelt auf gleichmäßigen Abstand `step`; der letzte Punkt bleibt erhalten. */
export function resample(pts: XY[], step: number): XY[] {
  if (pts.length < 2) return pts.slice();
  const out: XY[] = [pts[0]!];
  let carried = 0; // Distanz seit letztem Ausgabepunkt
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const segLen = dist(a, b);
    if (segLen === 0) continue;
    let pos = step - carried;
    while (pos <= segLen) {
      const t = pos / segLen;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      pos += step;
    }
    carried = segLen - (pos - step);
  }
  const last = pts[pts.length - 1]!;
  if (dist(out[out.length - 1]!, last) > 1e-6) out.push(last);
  return out;
}

/** Gleitender Mittelwert (Fenster ±halfWindow); Endpunkte bleiben unverändert. */
export function smooth(pts: XY[], halfWindow: number): XY[] {
  if (halfWindow <= 0 || pts.length < 3) return pts.slice();
  return pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1) return p;
    const h = Math.min(halfWindow, i, pts.length - 1 - i);
    let sx = 0, sy = 0;
    for (let j = i - h; j <= i + h; j++) {
      sx += pts[j]!.x;
      sy += pts[j]!.y;
    }
    const n = 2 * h + 1;
    return { x: sx / n, y: sy / n };
  });
}
