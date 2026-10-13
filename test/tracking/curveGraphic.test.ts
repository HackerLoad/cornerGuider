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
