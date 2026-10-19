import { detectCurvesXY } from '../curves';
import type { Curve, Shape } from '../curves/types';
import { snapToPolyline } from '../geo/linearRef';
import { dist } from '../geo/polyline';
import { makeProjection } from '../geo/projection';
import { calcLeanDeg } from '../tracking/leanAngle';
import type { FreerideRecording, RecordedCurve } from './recordingFormat';

export interface PredictedInfo {
  grade: number;
  minRadius: number | null;
  shape: Shape | null;
  confidence: number | null;
}

export interface DrivenInfo {
  grade: number;
  /** Mindestradius der tatsächlich gefahrenen Spur (m) */
  minRadius: number;
  shape: Shape;
  /** Mittlere GPS-Geschwindigkeit in der Kurve (m/s) */
  avgSpeedMs: number | null;
  /** Größte gemessene Neigung gegenüber dem Nullpunkt in der Kurve (Grad); null ohne Sensorwerte */
  maxTiltDeg: number | null;
  /** Rechnerische Schräglage atan(v²/(r·g)) aus mittlerer Geschwindigkeit und gefahrenem Radius (Grad) */
  calcLeanDeg: number | null;
}

export interface CalibrationRow {
  /** Strecke entlang der gefahrenen Spur (m) */
  pos: number;
  direction: 'left' | 'right';
  predicted: PredictedInfo | null;
  driven: DrivenInfo | null;
}

export interface CalibrationSummary {
  fixes: number;
  fixesWithTilt: number;
  sensor: boolean;
  zeroAt: number | null;
  matched: number;
  predictedOnly: number;
  drivenOnly: number;
}

export interface CalibrationResult {
  rows: CalibrationRow[];
  summary: CalibrationSummary;
}

export interface CalibrationOptions {
  /** Höchstabstand der Kurvenanfänge für die Zuordnung (m) */
  posTolM: number;
  /** Nicht angesagte gefahrene Kurven nur bis zu dieser Stufe auflisten */
  maxDrivenOnlyGrade: number;
  /** Messpunkte dieser Strecke (m) vor/hinter der Kurve zählen noch zur Kurve (die Punkte liegen ~15 m auseinander) */
  windowM: number;
}

const DEFAULTS: CalibrationOptions = { posTolM: 40, maxDrivenOnlyGrade: 4, windowM: 10 };

/**
 * Ordnet jede angesagte (vorhergesagte) Kurve der tatsächlich gefahrenen zu und trägt Geschwindigkeit sowie
 * gemessene und rechnerische Schräglage ein. Wertet nur aus – verändert keine Schwellwerte.
 */
export function calibrate(rec: FreerideRecording, opts: Partial<CalibrationOptions> = {}): CalibrationResult {
  const o = { ...DEFAULTS, ...opts };
  const proj = makeProjection(rec.origin);
  const xy = rec.fixes.map((f) => proj.toXY(f));
  const summary: CalibrationSummary = {
    fixes: rec.fixes.length,
    fixesWithTilt: rec.fixes.filter((f) => f.tiltDeg !== null).length,
    sensor: rec.lean.sensor,
    zeroAt: rec.lean.zeroAt,
    matched: 0,
    predictedOnly: 0,
    drivenOnly: 0,
  };
  if (rec.fixes.length < 3) return { rows: [], summary };

  const det = detectCurvesXY(xy, rec.origin);
  // Lage jedes Messpunkts auf der gefahrenen Spur (die Reihenfolge ist monoton, das begrenzt die Suche)
  const fixDist: number[] = [];
  let prev = 0;
  for (const p of xy) {
    const d = snapToPolyline(p, det.path, det.dist, { minDist: prev - 60 }).dist;
    fixDist.push(d);
    prev = Math.max(prev, d);
  }

  const predicted: RecordedCurve[] = rec.announcements.flatMap((a) => a.curves);

  // Zuordnung: nächstgelegene Paare zuerst, gleiche Richtung, Anfänge höchstens posTolM auseinander
  const pairs: { p: number; d: number; dist: number }[] = [];
  predicted.forEach((pc, pi) =>
    det.curves.forEach((dc, di) => {
      if (dc.direction !== pc.direction) return;
      const gap = dist(dc.startXY, pc.start);
      if (gap <= o.posTolM) pairs.push({ p: pi, d: di, dist: gap });
    }),
  );
  pairs.sort((a, b) => a.dist - b.dist);
  const predToDriven = new Map<number, number>();
  const usedDriven = new Set<number>();
  for (const pr of pairs) {
    if (predToDriven.has(pr.p) || usedDriven.has(pr.d)) continue;
    predToDriven.set(pr.p, pr.d);
    usedDriven.add(pr.d);
  }

  const drivenInfo = (c: Curve): DrivenInfo => {
    const idx = rec.fixes
      .map((_, i) => i)
      .filter((i) => fixDist[i]! >= c.startDist - o.windowM && fixDist[i]! <= c.endDist + o.windowM);
    const speeds = idx.map((i) => rec.fixes[i]!.speed).filter((v): v is number => v !== null);
    const tilts = idx.map((i) => rec.fixes[i]!.tiltDeg).filter((v): v is number => v !== null);
    const avg = speeds.length ? speeds.reduce((s, v) => s + v, 0) / speeds.length : null;
    return {
      grade: c.grade,
      minRadius: c.minRadius,
      shape: c.shape,
      avgSpeedMs: avg,
      maxTiltDeg: tilts.length ? Math.max(...tilts) : null,
      calcLeanDeg: avg === null ? null : calcLeanDeg(avg, c.minRadius),
    };
  };
  const predictedInfo = (c: RecordedCurve): PredictedInfo => ({
    grade: c.grade,
    minRadius: c.minRadius,
    shape: c.shape,
    confidence: c.confidence,
  });

  const rows: CalibrationRow[] = [];
  predicted.forEach((pc, pi) => {
    const di = predToDriven.get(pi);
    if (di !== undefined) {
      const dc = det.curves[di]!;
      rows.push({ pos: dc.startDist, direction: dc.direction, predicted: predictedInfo(pc), driven: drivenInfo(dc) });
      summary.matched++;
    } else {
      rows.push({
        pos: snapToPolyline(pc.start, det.path, det.dist).dist,
        direction: pc.direction,
        predicted: predictedInfo(pc),
        driven: null,
      });
      summary.predictedOnly++;
    }
  });
  det.curves.forEach((dc, di) => {
    if (usedDriven.has(di) || dc.grade > o.maxDrivenOnlyGrade) return;
    rows.push({ pos: dc.startDist, direction: dc.direction, predicted: null, driven: drivenInfo(dc) });
    summary.drivenOnly++;
  });
  rows.sort((a, b) => a.pos - b.pos);
  return { rows, summary };
}

const shapeShort: Record<Shape, string> = { tightening: 'zieht zu', opening: 'öffnet', constant: 'gleichm.' };
const num = (x: number | null | undefined, digits = 0) => (x === null || x === undefined ? '–' : x.toFixed(digits));

/** Die Tabelle für die Konsole (`npm run calibrate`). */
export function formatCalibration(res: CalibrationResult): string {
  const { rows, summary: s } = res;
  const lines: string[] = [];
  lines.push(
    `Messpunkte ${s.fixes}, mit gemessener Neigung ${s.fixesWithTilt}; Sensor ${s.sensor ? 'ja' : 'nein'}, ` +
      `Nullpunkt ${s.zeroAt !== null ? 'ja' : 'nein'}`,
  );
  lines.push(`Kurven: zugeordnet ${s.matched}, nur angesagt ${s.predictedOnly}, nur gefahren (Stufe ≤ 4) ${s.drivenOnly}`);
  if (s.fixesWithTilt === 0) {
    lines.push('Keine gemessene Schräglage (Sensor fehlt oder kein Nullpunkt im Stand): nur rechnerisch.');
  }
  lines.push('');
  lines.push(
    '  #  Pos[m]  Richtung  vorh.Stufe  vorh.R[m]  vorh.Form  conf  gef.Stufe  gef.R[m]  gef.Form  Ø v[km/h]  Schräglage gem.[°]  rechn.[°]',
  );
  rows.forEach((r, i) => {
    const p = r.predicted;
    const d = r.driven;
    lines.push(
      [
        String(i + 1).padStart(3),
        num(r.pos).padStart(7),
        (r.direction === 'left' ? 'Links' : 'Rechts').padEnd(8),
        num(p?.grade).padStart(10),
        num(p?.minRadius).padStart(9),
        (p?.shape ? shapeShort[p.shape] : '–').padEnd(9),
        num(p?.confidence, 2).padStart(5),
        num(d?.grade).padStart(9),
        num(d?.minRadius).padStart(8),
        (d ? shapeShort[d.shape] : '–').padEnd(8),
        num(d?.avgSpeedMs == null ? null : d.avgSpeedMs * 3.6).padStart(9),
        num(d?.maxTiltDeg, 1).padStart(18),
        num(d?.calcLeanDeg, 1).padStart(9),
      ].join('  '),
    );
  });
  return lines.join('\n');
}
