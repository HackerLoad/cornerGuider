import type { XY } from '../geo/types';

export interface FittedGeometry {
  /** SVG-Pfad "M x y L x y …" der gesamten Geometrie */
  full: string;
  /** Nur der Kurventeil */
  curve: string;
  /** Position des Kurvenanfangs in SVG-Koordinaten */
  start: XY;
  /** Position des Kurvenendes */
  end: XY;
  /** Skalierung (px pro m) */
  scale: number;
}

/**
 * Passt die Kurvengeometrie (x = rechts, y = vorwärts) in eine Fläche w×h ein.
 * SVG-y zeigt nach unten, deshalb wird y gespiegelt: Fahrtrichtung bleibt oben.
 */
export function fitGeometry(
  geometry: XY[],
  curveStart: number,
  curveEnd: number,
  w: number,
  h: number,
  padding: number,
): FittedGeometry {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of geometry) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  // Mindestgröße, damit fast gerade Kurven nicht extrem vergrößert werden
  const spanX = Math.max(maxX - minX, 40);
  const spanY = Math.max(maxY - minY, 40);
  const scale = Math.min((w - 2 * padding) / spanX, (h - 2 * padding) / spanY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const tx = (p: XY): XY => ({ x: w / 2 + (p.x - cx) * scale, y: h / 2 - (p.y - cy) * scale });

  const pts = geometry.map(tx);
  const path = (a: number, b: number) =>
    pts
      .slice(a, b + 1)
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
  return {
    full: path(0, pts.length - 1),
    curve: path(curveStart, curveEnd),
    start: pts[curveStart]!,
    end: pts[curveEnd]!,
    scale,
  };
}
