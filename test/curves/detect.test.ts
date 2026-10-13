import { detectCurves } from '../../src/curves';
import { TrackBuilder } from './helpers';

const near = (actual: number, expected: number, tol: number) =>
  expect(Math.abs(actual - expected) / expected).toBeLessThanOrEqual(tol);

describe('detectCurves – synthetische Geometrien', () => {
  it('Gerade → keine Kurve', () => {
    const t = new TrackBuilder().straight(1000);
    expect(detectCurves(t.latLon()).curves).toHaveLength(0);
  });

  it('Kreisbogen R=100, 90° rechts', () => {
    const t = new TrackBuilder().straight(200).arc('right', 100, 90).straight(200);
    const { curves } = detectCurves(t.latLon());
    expect(curves).toHaveLength(1);
    const c = curves[0]!;
    expect(c.direction).toBe('right');
    near(c.minRadius, 100, 0.1);
    near(c.totalAngle, 90, 0.15);
    near(c.startDist, 200, 0.1);
    expect(c.shape).toBe('constant');
    expect(c.grade).toBe(5); // 100*0.9=90 → ≤130
    expect(c.followsPrevious).toBe(false);
  });

  it('Linkskurve R=250 → Stufe 6', () => {
    const t = new TrackBuilder().straight(100).arc('left', 250, 40).straight(100);
    const c = detectCurves(t.latLon()).curves[0]!;
    expect(c.direction).toBe('left');
    expect(c.grade).toBe(6);
  });

  it('Spitzkehre R=10, 180° → Stufe 1', () => {
    const t = new TrackBuilder().straight(100).arc('left', 10, 180).straight(100);
    const { curves } = detectCurves(t.latLon());
    expect(curves).toHaveLength(1);
    const c = curves[0]!;
    expect(c.grade).toBe(1);
    expect(c.minRadius).toBeLessThan(15);
    near(c.totalAngle, 180, 0.2);
  });

  it('S-Kurve → zwei Kurven entgegengesetzter Richtung, als Folge markiert', () => {
    const t = new TrackBuilder().straight(150).arc('left', 60, 70).arc('right', 60, 70).straight(150);
    const { curves } = detectCurves(t.latLon());
    expect(curves).toHaveLength(2);
    expect(curves[0]!.direction).toBe('left');
    expect(curves[1]!.direction).toBe('right');
    expect(curves[1]!.followsPrevious).toBe(true);
    expect(curves[0]!.followsPrevious).toBe(false);
  });

  it('Kurven mit > 50 m Gerade dazwischen sind keine Folge', () => {
    const t = new TrackBuilder().straight(100).arc('left', 60, 60).straight(120).arc('left', 60, 60).straight(100);
    const { curves } = detectCurves(t.latLon());
    expect(curves).toHaveLength(2);
    expect(curves[1]!.followsPrevious).toBe(false);
    expect(curves[1]!.gapToPrevious!).toBeGreaterThan(100);
  });

  it('kurze Lücke gleicher Richtung wird zu einer Kurve zusammengeführt', () => {
    const t = new TrackBuilder().straight(100).arc('right', 80, 40).straight(15).arc('right', 80, 40).straight(100);
    expect(detectCurves(t.latLon()).curves).toHaveLength(1);
  });

  it('zugehende Kurve (Radius sinkt) wird erkannt, Mindestradius ist der engste', () => {
    const t = new TrackBuilder().straight(100).arc('left', 150, 30).arc('left', 90, 30).arc('left', 40, 40).straight(100);
    const { curves } = detectCurves(t.latLon());
    expect(curves).toHaveLength(1);
    expect(curves[0]!.shape).toBe('tightening');
    near(curves[0]!.minRadius, 40, 0.15);
  });

  it('aufgehende Kurve', () => {
    const t = new TrackBuilder().straight(100).arc('right', 40, 40).arc('right', 90, 30).arc('right', 150, 30).straight(100);
    expect(detectCurves(t.latLon()).curves[0]!.shape).toBe('opening');
  });

  it('Geometrie: Einfahrt zeigt nach +y, Linkskurve biegt nach -x', () => {
    const t = new TrackBuilder().straight(100).arc('left', 60, 90).straight(100);
    const c = detectCurves(t.latLon()).curves[0]!;
    const start = c.geometry[c.geometryCurveStart]!;
    expect(Math.hypot(start.x, start.y)).toBeLessThan(1e-6);
    const before = c.geometry[0]!;
    expect(before.y).toBeLessThan(0);
    expect(Math.abs(before.x)).toBeLessThan(1);
    const end = c.geometry[c.geometryCurveEnd]!;
    expect(end.x).toBeLessThan(-30);
  });

  it('Reihenfolge der Distanzen ist aufsteigend, Indizes fortlaufend', () => {
    const t = new TrackBuilder().straight(100).arc('left', 60, 60).straight(200).arc('right', 60, 60).straight(100);
    const { curves } = detectCurves(t.latLon());
    expect(curves.map((c) => c.index)).toEqual([0, 1]);
    expect(curves[1]!.startDist).toBeGreaterThan(curves[0]!.endDist);
  });
});
