import { cumulativeLengths, dedupe, resample, smooth } from '../geo/polyline';
import { projectionForPoints } from '../geo/projection';
import type { LatLon, XY } from '../geo/types';
import { gradeForRadius } from './classify';
import { markSequences } from './combine';
import { DEFAULT_CURVE_CONFIG, type CurveConfig } from './config';
import { signedCurvature } from './radius';
import type { Curve, DetectionResult, Direction, Shape } from './types';

interface Run {
  from: number; // Sample-Index (inkl.)
  to: number; // Sample-Index (inkl.)
  sign: 1 | -1;
}

/** Erkennt alle Kurven einer Route (reine Funktion, keine RN-Abhängigkeiten). */
export function detectCurves(
  points: LatLon[],
  config: Partial<CurveConfig> = {},
): DetectionResult {
  const cfg: CurveConfig = { ...DEFAULT_CURVE_CONFIG, ...config };
  if (points.length < 2) throw new Error('detectCurves: mindestens 2 Punkte nötig');

  // 1. Projektion
  const proj = projectionForPoints(points);
  const xy = dedupe(points.map((p) => proj.toXY(p)));

  // 2. Resampeln + glätten
  const path = smooth(resample(xy, cfg.resampleStepM), cfg.smoothHalfWindow);
  const dist = cumulativeLengths(path);
  const length = dist[dist.length - 1] ?? 0;

  // 3. Krümmung pro Sample
  const k = Math.max(1, Math.round(cfg.radiusSpanM / cfg.resampleStepM));
  const curvature = new Array<number>(path.length).fill(0);
  for (let i = k; i < path.length - k; i++) {
    curvature[i] = signedCurvature(path[i - k]!, path[i]!, path[i + k]!);
  }

  // 4. Segmente
  const minCurv = 1 / cfg.maxCurveRadiusM;
  const runs = buildRuns(curvature, minCurv, Math.round(cfg.mergeGapM / cfg.resampleStepM));

  // 5. Kennwerte
  const curves: Curve[] = [];
  for (const run of runs) {
    const curve = buildCurve(run, path, dist, curvature, cfg);
    if (curve) curves.push(curve);
  }
  curves.forEach((c, i) => (c.index = i));

  markSequences(curves, cfg);
  return { curves, length, path, dist, projectionOrigin: proj.origin };
}

function buildRuns(curvature: number[], minCurv: number, mergeGapSamples: number): Run[] {
  const runs: Run[] = [];
  let cur: Run | null = null;
  for (let i = 0; i < curvature.length; i++) {
    const c = curvature[i]!;
    const sign: 1 | -1 | 0 = Math.abs(c) >= minCurv ? (c > 0 ? 1 : -1) : 0;
    if (sign === 0) {
      cur = null;
      continue;
    }
    if (cur && cur.sign === sign) {
      cur.to = i;
    } else {
      cur = { from: i, to: i, sign };
      runs.push(cur);
    }
  }
  // Lücken gleicher Richtung zusammenführen (benachbarte Runs mit Gegenrichtung bleiben getrennt)
  const merged: Run[] = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last && last.sign === r.sign && r.from - last.to - 1 <= mergeGapSamples) {
      last.to = r.to;
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

function buildCurve(
  run: Run,
  path: XY[],
  dist: number[],
  curvature: number[],
  cfg: CurveConfig,
): Curve | null {
  const { from, to, sign } = run;
  const step = cfg.resampleStepM;
  const startDist = dist[from]!;
  const endDist = dist[to]!;
  const length = endDist - startDist;

  // Gesamtwinkel = ∫|κ| ds (nur Beiträge in Kurvenrichtung)
  let angle = 0;
  let maxCurv = 0;
  for (let i = from; i <= to; i++) {
    const kc = curvature[i]! * sign;
    if (kc > 0) angle += kc * step;
    maxCurv = Math.max(maxCurv, kc);
  }
  const totalAngle = (angle * 180) / Math.PI;
  if (totalAngle < cfg.minTotalAngleDeg || length < cfg.minLengthM || maxCurv <= 0) return null;

  const minRadius = 1 / maxCurv;
  const direction: Direction = sign > 0 ? 'left' : 'right';

  return {
    index: 0,
    startDist,
    endDist,
    length,
    minRadius,
    totalAngle,
    direction,
    shape: shapeOf(curvature, from, to, sign, cfg),
    grade: gradeForRadius(minRadius, cfg),
    followsPrevious: false,
    gapToPrevious: null,
    ...buildGeometry(from, to, path, cfg),
  };
}

function shapeOf(curvature: number[], from: number, to: number, sign: number, cfg: CurveConfig): Shape {
  const n = to - from + 1;
  const m = Math.max(1, Math.floor(n * cfg.shapeFraction));
  const mean = (a: number, b: number) => {
    let s = 0;
    for (let i = a; i <= b; i++) s += Math.max(0, curvature[i]! * sign);
    return s / (b - a + 1);
  };
  const head = mean(from, from + m - 1);
  const tail = mean(to - m + 1, to);
  if (tail > head * cfg.shapeRatio) return 'tightening';
  if (head > tail * cfg.shapeRatio) return 'opening';
  return 'constant';
}

/** Geometrie ±Rand, Ursprung = Kurvenanfang, Einfahrtsrichtung = +y. */
function buildGeometry(from: number, to: number, path: XY[], cfg: CurveConfig) {
  const marginSamples = Math.round(cfg.geometryMarginM / cfg.resampleStepM);
  const i0 = Math.max(0, from - marginSamples);
  const i1 = Math.min(path.length - 1, to + marginSamples);
  const origin = path[from]!;

  // Einfahrtsrichtung aus den ~15 m vor dem Kurvenanfang (Fallback: nach vorn)
  const back = path[Math.max(0, from - Math.max(1, Math.round(cfg.radiusSpanM / cfg.resampleStepM)))]!;
  let hx = origin.x - back.x;
  let hy = origin.y - back.y;
  if (Math.hypot(hx, hy) < 1e-6) {
    const fwd = path[Math.min(path.length - 1, from + 1)]!;
    hx = fwd.x - origin.x;
    hy = fwd.y - origin.y;
  }
  const h = Math.hypot(hx, hy) || 1;
  hx /= h;
  hy /= h;

  const geometry: XY[] = [];
  for (let i = i0; i <= i1; i++) {
    const dx = path[i]!.x - origin.x;
    const dy = path[i]!.y - origin.y;
    // Rotation, sodass (hx,hy) → (0,1)
    geometry.push({ x: dx * hy - dy * hx, y: dx * hx + dy * hy });
  }
  return { geometry, geometryCurveStart: from - i0, geometryCurveEnd: to - i0 };
}
