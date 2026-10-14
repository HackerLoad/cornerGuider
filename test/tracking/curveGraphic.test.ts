import { detectCurves } from '../../src/curves';
import { fitGeometry } from '../../src/components/curveGraphicMath';
import { TrackBuilder } from '../curves/helpers';

describe('fitGeometry', () => {
  const c = detectCurves(new TrackBuilder().straight(100).arc('left', 50, 90).straight(100).latLon()).curves[0]!;
  const fit = fitGeometry(c.geometry, c.geometryCurveStart, c.geometryCurveEnd, 300, 300, 20);

  it('passt in die Fläche', () => {
    const nums = [...fit.full.matchAll(/(-?\d+\.\d) (-?\d+\.\d)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);
    for (const [x, y] of nums) {
      expect(x).toBeGreaterThanOrEqual(19);
      expect(x).toBeLessThanOrEqual(281);
      expect(y).toBeGreaterThanOrEqual(19);
      expect(y).toBeLessThanOrEqual(281);
    }
  });

  it('Fahrtrichtung oben: Anfang liegt unter dem Ende, Linkskurve endet links', () => {
    expect(fit.start.y).toBeGreaterThan(fit.end.y);
    expect(fit.end.x).toBeLessThan(fit.start.x);
  });
});

import { LINE_AMPLITUDE, OWN_LANE_CENTER, buildRoadGraphic, ridingLineOffsets } from '../../src/components/curveGraphicMath';

describe('Fahrlinie', () => {
  const N = 40, S = 10, E = 30;
  const lo = OWN_LANE_CENTER - LINE_AMPLITUDE;
  const hi = OWN_LANE_CENTER + LINE_AMPLITUDE;

  it('bleibt immer innerhalb der eigenen Spur (rechts der Mittellinie)', () => {
    for (const dir of ['left', 'right'] as const) {
      for (const shape of ['tightening', 'opening', 'constant'] as const) {
        for (const o of ridingLineOffsets(N, S, E, dir, shape)) {
          expect(o).toBeGreaterThanOrEqual(lo - 1e-9);
          expect(o).toBeLessThanOrEqual(hi + 1e-9);
          expect(o).toBeLessThan(0); // nie über die Mittellinie
        }
      }
    }
  });

  it('Linkskurve: Scheitel innen (links, zur Mittellinie), Rechtskurve: Scheitel innen (rechts, zum Rand)', () => {
    const left = ridingLineOffsets(N, S, E, 'left', 'constant');
    const right = ridingLineOffsets(N, S, E, 'right', 'constant');
    expect(Math.max(...left)).toBeCloseTo(hi, 6);
    expect(Math.min(...right)).toBeCloseTo(lo, 6);
    // Einfahrt außen: bei Kurvenanfang liegt die Linke Kurve am rechten Rand
    expect(left[S]).toBeCloseTo(lo, 6);
    expect(right[S]).toBeCloseTo(hi, 6);
  });

  it('Start und Ende in der Spurmitte', () => {
    const o = ridingLineOffsets(N, S, E, 'left', 'constant');
    expect(o[0]).toBeCloseTo(OWN_LANE_CENTER, 6);
    expect(o[N - 1]).toBeCloseTo(OWN_LANE_CENTER, 6);
  });

  it('Scheitel liegt später bei zugehender als bei aufgehender Kurve', () => {
    const idx = (shape: 'tightening' | 'opening') => {
      const o = ridingLineOffsets(N, S, E, 'left', shape);
      return o.indexOf(Math.max(...o));
    };
    expect(idx('tightening')).toBeGreaterThan(idx('opening'));
  });
});

describe('buildRoadGraphic', () => {
  const c = detectCurves(new TrackBuilder().straight(100).arc('right', 50, 90).straight(100).latLon()).curves[0]!;
  it('liefert Pfade und Fahrerposition; die Fahrlinie liegt rechts der Mittellinie', () => {
    const g = buildRoadGraphic(c, 300, 300, 30);
    expect(g.center.startsWith('M')).toBe(true);
    expect(g.line.startsWith('M')).toBe(true);
    expect(g.roadWidth).toBeGreaterThanOrEqual(40);
    // Fahrer startet auf gerader Einfahrt in der rechten Spur (Fahrtrichtung oben → rechts = größeres x)
    const first = g.center.match(/M(-?[\d.]+) (-?[\d.]+)/)!;
    expect(g.rider.x).toBeGreaterThan(Number(first[1]));
  });
});

describe('Straßenbreite bei Spitzkehre', () => {
  it('ist schmaler als der Abstand der beiden Schenkel (keine Überlappung)', () => {
    const c = detectCurves(new TrackBuilder().straight(100).arc('left', 12, 180).straight(100).latLon()).curves[0]!;
    const g = buildRoadGraphic(c, 360, 360, 36);
    // Schenkelabstand ≈ 2·R·scale; Breite muss kleiner sein
    expect(g.roadWidth).toBeLessThan(2 * 12 * g.scale);
    expect(g.roadWidth).toBeGreaterThanOrEqual(14);
    expect(g.lineWidth).toBeLessThanOrEqual(4.5);
  });
});
