import { DrivenRadius } from '../../src/tracking/drivenRadius';
import { GravityFilter, LeanTracker, calcLeanDeg, tiltDeg, type Vec3 } from '../../src/tracking/leanAngle';

/** Dreht v um die (Einheits-)Achse axis um deg Grad (Rodrigues). */
function rotate(v: Vec3, axis: Vec3, deg: number): Vec3 {
  const a = (deg * Math.PI) / 180;
  const [x, y, z] = axis;
  const n = Math.hypot(x, y, z);
  const k: Vec3 = [x / n, y / n, z / n];
  const dot = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const cr: Vec3 = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
  return [0, 1, 2].map((i) => v[i]! * Math.cos(a) + cr[i]! * Math.sin(a) + k[i]! * dot * (1 - Math.cos(a))) as Vec3;
}

describe('rechnerische Schräglage atan(v²/(r·g))', () => {
  it('Beispielwerte', () => {
    expect(calcLeanDeg(15, 50)).toBeCloseTo(24.64, 1);
    expect(calcLeanDeg(10, 100)).toBeCloseTo(5.82, 1);
    expect(calcLeanDeg(20, 40)).toBeCloseTo(45.5, 0);
  });
  it('Gerade, Stand und fehlende Werte → 0', () => {
    expect(calcLeanDeg(15, null)).toBe(0);
    expect(calcLeanDeg(15, Infinity)).toBe(0);
    expect(calcLeanDeg(0, 50)).toBe(0);
    expect(calcLeanDeg(null, 50)).toBe(0);
  });
});

describe('tiltDeg: Winkel zur Nullrichtung, unabhängig von der Einbaulage', () => {
  it('Drehung um eine Achse senkrecht zur Schwerkraft: 30° → 30°, 45° → 45° (beliebige Einbaulage)', () => {
    const zero: Vec3 = [0.3, -0.5, -0.81];
    const axis: Vec3 = [-0.5, -0.3, 0]; // zero · axis = -0.15 + 0.15 = 0
    expect(tiltDeg(zero, rotate(zero, axis, 30))).toBeCloseTo(30, 3);
    expect(tiltDeg(zero, rotate(zero, axis, 45))).toBeCloseTo(45, 3);
    const zero2: Vec3 = [0, 1, 0];
    expect(tiltDeg(zero2, rotate(zero2, [0, 0, 1], 20))).toBeCloseTo(20, 3);
  });
  it('gleiche Richtung → 0, unnormierte Vektoren sind egal', () => {
    expect(tiltDeg([0, 0, -1], [0, 0, -9.81])).toBeCloseTo(0, 6);
  });
});

describe('LeanTracker: Nullpunkt im Stand', () => {
  const up: Vec3 = [0, 0, -1];
  it('nimmt den Nullpunkt aus mehreren Messungen im Stand, danach wird die Neigung gemeldet', () => {
    const t = new LeanTracker({ zeroSamples: 3 });
    expect(t.update(up, 0).tiltDeg).toBeNull(); // noch kein Nullpunkt
    t.update(up, 0.2);
    const third = t.update(up, 0);
    expect(third.tiltDeg).toBe(0);
    expect(t.zero).not.toBeNull();
    const tilted = rotate(up, [1, 0, 0], 25);
    expect(t.update(tilted, 15).tiltDeg).toBeCloseTo(25, 1);
  });
  it('ohne Nullpunkt (Start in Fahrt) gibt es keine Neigung, aber den Rohwert', () => {
    const t = new LeanTracker({ zeroSamples: 3 });
    const r = t.update(up, 12);
    expect(r.tiltDeg).toBeNull();
    expect(r.gravity).not.toBeNull();
    expect(t.zero).toBeNull();
  });
  it('nimmt den Nullpunkt später bei einem Halt nach, ohne ihn danach zu ändern', () => {
    const t = new LeanTracker({ zeroSamples: 2 });
    t.update(up, 12);
    t.update(up, 0);
    t.update(up, 0);
    const z = t.zero;
    expect(z).not.toBeNull();
    t.update(rotate(up, [1, 0, 0], 40), 0);
    t.update(rotate(up, [1, 0, 0], 40), 0);
    expect(t.zero).toEqual(z);
  });
  it('ohne Sensor (null) bleibt alles null', () => {
    const t = new LeanTracker();
    expect(t.update(null, 0)).toEqual({ gravity: null, tiltDeg: null });
  });
  it('Unterbrechung im Stand setzt die Sammlung zurück', () => {
    const t = new LeanTracker({ zeroSamples: 3 });
    t.update(up, 0);
    t.update(up, 0);
    t.update(up, 9); // Bewegung
    t.update(up, 0);
    expect(t.zero).toBeNull();
  });
});

describe('GravityFilter', () => {
  it('glättet Ausreißer, hält die Richtung', () => {
    const f = new GravityFilter(0.2);
    for (let i = 0; i < 30; i++) f.push([0, 0, -9.8]);
    f.push([3, 0, -9.8]);
    const g = f.value()!;
    expect(Math.abs(g[0])).toBeLessThan(0.2);
    expect(f.value()).not.toBeNull();
  });
  it('ohne Messung null', () => {
    expect(new GravityFilter().value()).toBeNull();
  });
});

describe('DrivenRadius: Radius aus den letzten gefahrenen Positionen', () => {
  const onCircle = (r: number, spacing: number, n: number) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * spacing) / r;
      return { x: r * Math.sin(a), y: r * (1 - Math.cos(a)) };
    });
  it('Kreis R=50 mit 15 m Abstand → ≈ 50 m', () => {
    const d = new DrivenRadius();
    let last: number | null = null;
    for (const p of onCircle(50, 15, 8)) last = d.push(p);
    expect(last).not.toBeNull();
    expect(last!).toBeGreaterThan(45);
    expect(last!).toBeLessThan(55);
  });
  it('Gerade → null', () => {
    const d = new DrivenRadius();
    let last: number | null = 1;
    for (let i = 0; i < 8; i++) last = d.push({ x: i * 15, y: 0 });
    expect(last).toBeNull();
  });
  it('zu dicht beieinander (Stand) → null', () => {
    const d = new DrivenRadius();
    let last: number | null = 1;
    for (let i = 0; i < 8; i++) last = d.push({ x: i * 0.5, y: 0.2 * (i % 2) });
    expect(last).toBeNull();
  });
});
