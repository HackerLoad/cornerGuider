import { detectCurvesXY } from '../../src/curves';
import { tightenForConfidence } from '../../src/curves/classify';
import { DEFAULT_CURVE_CONFIG } from '../../src/curves/config';
import {
  geometryConfidence,
  gpsAccuracyFactor,
  isUncertain,
  junctionFactor,
  withConfidenceFactor,
} from '../../src/curves/confidence';
import type { XY } from '../../src/geo/types';
import { TrackBuilder } from './helpers';

const ORIGIN = { lat: 47, lon: 11 };
const cfg = DEFAULT_CURVE_CONFIG;

/** Behält nur etwa alle `everyM` Meter einen Knoten (1-m-Raster des TrackBuilders), Anfang und Ende bleiben. */
function thin(pts: XY[], everyM: number): XY[] {
  const out: XY[] = [pts[0]!];
  let last = pts[0]!;
  for (let i = 1; i < pts.length - 1; i++) {
    if (Math.hypot(pts[i]!.x - last.x, pts[i]!.y - last.y) >= everyM) {
      out.push(pts[i]!);
      last = pts[i]!;
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

describe('Konfidenz aus der Knotendichte', () => {
  const track = new TrackBuilder().straight(200).arc('right', 80, 120).straight(200).xy();

  it('feine Geometrie (Knoten alle ~5 m) → hohe Konfidenz', () => {
    const { curves } = detectCurvesXY(thin(track, 5), ORIGIN);
    expect(curves.length).toBeGreaterThan(0);
    for (const c of curves) expect(c.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('grobe Geometrie (Knoten alle ~60 m) → niedrige Konfidenz', () => {
    const { curves } = detectCurvesXY(thin(track, 60), ORIGIN);
    expect(curves.length).toBeGreaterThan(0);
    for (const c of curves) expect(c.confidence).toBeLessThan(cfg.uncertainBelow);
  });

  it('geometryConfidence ist monoton fallend und auf 0..1 begrenzt', () => {
    expect(geometryConfidence(0, cfg)).toBe(1);
    expect(geometryConfidence(cfg.goodNodeSpacingM, cfg)).toBe(1);
    expect(geometryConfidence(cfg.poorNodeSpacingM, cfg)).toBe(0);
    expect(geometryConfidence(1000, cfg)).toBe(0);
    const mid = geometryConfidence((cfg.goodNodeSpacingM + cfg.poorNodeSpacingM) / 2, cfg);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });
});

describe('weitere Konfidenz-Faktoren', () => {
  it('GPS-Genauigkeit: gut/unbekannt 1, schlecht klein, nie unter gpsMinFactor', () => {
    expect(gpsAccuracyFactor(null, cfg)).toBe(1);
    expect(gpsAccuracyFactor(cfg.gpsGoodAccuracyM, cfg)).toBe(1);
    expect(gpsAccuracyFactor(cfg.gpsPoorAccuracyM, cfg)).toBeCloseTo(cfg.gpsMinFactor);
    expect(gpsAccuracyFactor(500, cfg)).toBeCloseTo(cfg.gpsMinFactor);
    const mid = gpsAccuracyFactor((cfg.gpsGoodAccuracyM + cfg.gpsPoorAccuracyM) / 2, cfg);
    expect(mid).toBeLessThan(1);
    expect(mid).toBeGreaterThan(cfg.gpsMinFactor);
  });

  it('Kreuzung: nur am Pfadende vor einer unklaren Kreuzung', () => {
    expect(junctionFactor(10, 'junction', cfg)).toBe(cfg.junctionConfidenceFactor);
    expect(junctionFactor(cfg.junctionProximityM + 1, 'junction', cfg)).toBe(1);
    expect(junctionFactor(10, 'horizon', cfg)).toBe(1);
    expect(junctionFactor(10, undefined, cfg)).toBe(1);
  });

  it('withConfidenceFactor kopiert nur bei Faktor ≠ 1', () => {
    const { curves } = detectCurvesXY(new TrackBuilder().straight(100).arc('left', 60, 90).straight(100).xy(), ORIGIN);
    const c = curves[0]!;
    expect(withConfidenceFactor(c, 1)).toBe(c);
    const half = withConfidenceFactor(c, 0.5);
    expect(half).not.toBe(c);
    expect(half.confidence).toBeCloseTo(c.confidence * 0.5);
  });

  it('isUncertain vergleicht mit der Schwelle', () => {
    expect(isUncertain(cfg.uncertainBelow - 0.01, cfg)).toBe(true);
    expect(isUncertain(cfg.uncertainBelow, cfg)).toBe(false);
  });
});

describe('Sicherheitsausrichtung (A2)', () => {
  it('Sicherheitsfaktor stuft Grenzkurven enger ein', () => {
    // R=16 m liegt knapp über der Stufe-1-Grenze (15 m); mit Faktor < 1 gilt es als Spitzkehre
    const arc = new TrackBuilder().straight(60).arc('left', 16, 180).straight(60).xy();
    const strict = detectCurvesXY(arc, ORIGIN, { safetyMarginRadiusFactor: 0.85 }).curves[0]!;
    const neutral = detectCurvesXY(arc, ORIGIN, { safetyMarginRadiusFactor: 1 }).curves[0]!;
    expect(strict.grade).toBeLessThanOrEqual(neutral.grade);
    expect(DEFAULT_CURVE_CONFIG.safetyMarginRadiusFactor).toBeLessThan(1);
  });

  it('tightenForConfidence: hohe Konfidenz unverändert, niedrige eine Stufe enger, nie unter 1', () => {
    expect(tightenForConfidence(4, 1, cfg)).toBe(4);
    expect(tightenForConfidence(4, cfg.reducedBelow, cfg)).toBe(4);
    expect(tightenForConfidence(4, cfg.reducedBelow - 0.01, cfg)).toBe(3);
    expect(tightenForConfidence(1, 0.1, cfg)).toBe(1);
  });

  it('grobe Geometrie: Stufe ist eine enger als die gemessene', () => {
    const track = new TrackBuilder().straight(200).arc('right', 80, 120).straight(200).xy();
    const fine = detectCurvesXY(thin(track, 5), ORIGIN).curves[0]!;
    expect(fine.grade).toBe(fine.measuredGrade);
    const coarse = detectCurvesXY(thin(track, 45), ORIGIN).curves;
    expect(coarse.length).toBeGreaterThan(0);
    for (const c of coarse) {
      expect(c.confidence).toBeLessThan(cfg.reducedBelow);
      expect(c.grade).toBe(Math.max(1, c.measuredGrade - 1));
    }
  });

  it('withConfidenceFactor rechnet die Stufe immer aus der gemessenen neu (kein doppeltes Verschärfen)', () => {
    const c = detectCurvesXY(new TrackBuilder().straight(100).arc('left', 60, 90).straight(100).xy(), ORIGIN).curves[0]!;
    expect(c.confidence).toBeGreaterThan(0.9);
    const low = withConfidenceFactor(c, 0.5);
    expect(low.grade).toBe(Math.max(1, c.measuredGrade - 1));
    const lower = withConfidenceFactor(low, 0.5);
    expect(lower.grade).toBe(Math.max(1, c.measuredGrade - 1));
    expect(withConfidenceFactor(low, 1).grade).toBe(low.grade);
  });
});
