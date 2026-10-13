import { cumulativeLengths, resample } from '../../src/geo/polyline';
import { snapToPolyline } from '../../src/geo/linearRef';
import { makeProjection } from '../../src/geo/projection';

describe('geo', () => {
  it('Projektion Roundtrip', () => {
    const p = makeProjection({ lat: 47, lon: 11 });
    const back = p.toLatLon(p.toXY({ lat: 47.01, lon: 11.02 }));
    expect(back.lat).toBeCloseTo(47.01, 9);
    expect(back.lon).toBeCloseTo(11.02, 9);
  });

  it('1° Breite ≈ 111 km', () => {
    const p = makeProjection({ lat: 0, lon: 0 });
    expect(p.toXY({ lat: 1, lon: 0 }).y).toBeGreaterThan(111000);
    expect(p.toXY({ lat: 1, lon: 0 }).y).toBeLessThan(111400);
  });

  it('resample liefert gleichmäßige Abstände', () => {
    const r = resample([{ x: 0, y: 0 }, { x: 33, y: 0 }, { x: 33, y: 20 }], 5);
    // 5 m Bogenlänge pro Schritt; über die Ecke ist die Sehne etwas kürzer
    for (let i = 1; i < r.length - 1; i++) {
      expect(Math.hypot(r[i]!.x - r[i - 1]!.x, r[i]!.y - r[i - 1]!.y)).toBeLessThanOrEqual(5 + 1e-9);
    }
    expect(r[6]!.x).toBeCloseTo(30, 6);
    expect(r[r.length - 1]).toEqual({ x: 33, y: 20 });
    const line = cumulativeLengths(resample([{ x: 0, y: 0 }, { x: 52, y: 0 }], 5));
    expect(line[line.length - 1]).toBeCloseTo(52, 6);
  });

  it('snapToPolyline: Distanz und Offset', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
    const cum = cumulativeLengths(pts);
    const s = snapToPolyline({ x: 50, y: 7 }, pts, cum);
    expect(s.dist).toBeCloseTo(50);
    expect(s.offset).toBeCloseTo(7);
    const s2 = snapToPolyline({ x: 103, y: 40 }, pts, cum);
    expect(s2.dist).toBeCloseTo(140);
  });
});
