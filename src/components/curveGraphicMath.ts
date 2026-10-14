import type { XY } from '../geo/types';

export interface FittedGeometry {
  /** SVG-Pfad "M x y L x y …" der gesamten Geometrie */
  full: string;
  /** Nur der Kurventeil */
  curve: string;
  /** Alle Punkte in SVG-Koordinaten */
  points: XY[];
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
    points: pts,
    start: pts[curveStart]!,
    end: pts[curveEnd]!,
    scale,
  };
}

// ---------------------------------------------------------------------------
// Straße mit Gegenspur und Fahrlinie
// ---------------------------------------------------------------------------

/** Quer zur Fahrtrichtung in Fahrbahnbreiten: 0 = Mittellinie, +1 = linker Rand, −1 = rechter Rand. */
export const OWN_LANE_CENTER = -0.5;
/** Auslenkung der Fahrlinie aus der Spurmitte (Spurbreite = 1); hält Abstand zu beiden Rändern der eigenen Spur. */
export const LINE_AMPLITUDE = 0.3;

type Dir = 'left' | 'right';
type Shape = 'tightening' | 'opening' | 'constant';

/** Zeitpunkt des Scheitelpunkts (0 = Kurvenanfang, 1 = Ende): später bei zugehender, früher bei aufgehender Kurve. */
export function apexPosition(shape: Shape): number {
  return shape === 'tightening' ? 0.7 : shape === 'opening' ? 0.4 : 0.55;
}

const smooth01 = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/**
 * Seitliche Lage der Fahrlinie je Punkt (in Fahrbahnbreiten, siehe OWN_LANE_CENTER).
 * Spurmitte → außen → Scheitel innen (später Scheitel) → außen → Spurmitte.
 * Bleibt immer innerhalb der eigenen Spur (Rechtsverkehr).
 */
export function ridingLineOffsets(
  count: number,
  curveStart: number,
  curveEnd: number,
  direction: Dir,
  shape: Shape,
): number[] {
  const inside = direction === 'left' ? 1 : -1; // Seite, zu der die Kurve biegt
  const tApex = apexPosition(shape);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    let p: number; // −1 = außen, +1 = innen
    if (i < curveStart) {
      p = -smooth01(curveStart === 0 ? 1 : i / curveStart);
    } else if (i > curveEnd) {
      const post = count - 1 - curveEnd;
      p = -(1 - smooth01(post === 0 ? 1 : (i - curveEnd) / post));
    } else {
      const t = curveEnd === curveStart ? 0 : (i - curveStart) / (curveEnd - curveStart);
      p = t < tApex ? -Math.cos((Math.PI * t) / tApex) : Math.cos((Math.PI * (t - tApex)) / (1 - tApex));
    }
    out.push(OWN_LANE_CENTER + inside * LINE_AMPLITUDE * p);
  }
  return out;
}

/** Linke Normale in Bildschirmkoordinaten (y nach unten), aus den Nachbarpunkten geglättet. */
function leftNormals(pts: XY[]): XY[] {
  return pts.map((_, i) => {
    const a = pts[Math.max(0, i - 4)]!;
    const b = pts[Math.min(pts.length - 1, i + 4)]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dy / len, y: -dx / len };
  });
}

/** Gleitender Mittelwert (±half), Endpunkte bleiben fest. */
function movingAverage(pts: XY[], half: number): XY[] {
  return pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1) return p;
    const h = Math.min(half, i, pts.length - 1 - i);
    let sx = 0, sy = 0;
    for (let j = i - h; j <= i + h; j++) {
      sx += pts[j]!.x;
      sy += pts[j]!.y;
    }
    return { x: sx / (2 * h + 1), y: sy / (2 * h + 1) };
  });
}

function toPath(pts: XY[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

export interface RoadGraphic {
  /** Mittellinie der Straße über die ganze Geometrie */
  center: string;
  /** Nur der Kurventeil der Mittellinie */
  curve: string;
  /** Fahrlinie durch die Kurve in der eigenen Spur */
  line: string;
  /** Position des Fahrers (Anfang der Fahrlinie) */
  rider: XY;
  start: XY;
  end: XY;
  /** Straßenbreite in px (beide Spuren) */
  roadWidth: number;
  /** Strichstärke der Fahrlinie und Radius des Fahrerpunkts (px) */
  lineWidth: number;
  riderRadius: number;
  scale: number;
}

interface CurveLike {
  geometry: XY[];
  geometryCurveStart: number;
  geometryCurveEnd: number;
  direction: Dir;
  shape: Shape;
}

/** Kleinster Abstand zwischen Punkten, die mindestens `minIndexGap` Stützpunkte auseinanderliegen. */
function minSeparation(pts: XY[], minIndexGap: number): number {
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + minIndexGap; j < pts.length; j++) {
      best = Math.min(best, Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y));
    }
  }
  return best;
}

/** Alles, was die Grafik braucht: Straßenband, Kurventeil und Fahrlinie in Pixeln. */
export function buildRoadGraphic(curve: CurveLike, w: number, h: number, padding: number): RoadGraphic {
  const fit = fitGeometry(curve.geometry, curve.geometryCurveStart, curve.geometryCurveEnd, w, h, padding);
  const pts = fit.points;
  // Breite wie gewünscht, aber so, dass sich Straßenstücke (z. B. beide Schenkel einer Spitzkehre) nicht überlappen
  const roadWidth = Math.max(14, Math.min(Math.min(64, Math.max(40, fit.scale * 7)), 0.8 * minSeparation(pts, 6)));
  const normals = leftNormals(pts);
  const offsets = ridingLineOffsets(
    pts.length,
    curve.geometryCurveStart,
    curve.geometryCurveEnd,
    curve.direction,
    curve.shape,
  );
  // Fahrlinie leicht glätten, damit sie nicht an den 5-m-Stützpunkten knickt
  const raw = pts.map((p, i) => ({
    x: p.x + normals[i]!.x * offsets[i]! * roadWidth,
    y: p.y + normals[i]!.y * offsets[i]! * roadWidth,
  }));
  const line = movingAverage(movingAverage(raw, 2), 2);
  return {
    center: fit.full,
    curve: fit.curve,
    line: toPath(line),
    rider: line[0]!,
    start: fit.start,
    end: fit.end,
    roadWidth,
    lineWidth: Math.min(4.5, Math.max(2.5, roadWidth * 0.12)),
    riderRadius: Math.min(7, Math.max(4, roadWidth * 0.17)),
    scale: fit.scale,
  };
}
