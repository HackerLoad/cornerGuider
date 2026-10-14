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
    expect(g.roadWidth).toBeGreaterThanOrEqual(28);
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

function distToPolyline(p: { x: number; y: number }, poly: { x: number; y: number }[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i]!, b = poly[i + 1]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    best = Math.min(best, Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)));
  }
  return best;
}

describe('Fahrlinie liegt auf dem Asphalt, in der eigenen Spur', () => {
  const cases: [string, ReturnType<TrackBuilder['arc']>][] = [
    ['Rechtskurve R=60', new TrackBuilder().straight(100).arc('right', 60, 90).straight(100)],
    ['Linkskurve R=60', new TrackBuilder().straight(100).arc('left', 60, 90).straight(100)],
    ['Linkskurve R=25', new TrackBuilder().straight(100).arc('left', 25, 120).straight(100)],
    ['Spitzkehre rechts R=12', new TrackBuilder().straight(100).arc('right', 12, 180).straight(100)],
  ];
  it.each(cases)('%s', (_name, t) => {
    const c = detectCurves(t.latLon()).curves[0]!;
    const g = buildRoadGraphic(c, 360, 360, 36);
    const half = g.roadWidth / 2;
    for (const p of g.linePts) {
      const d = distToPolyline(p, g.centerPts);
      // innerhalb der Fahrbahn (nie über den Rand) und nie auf der Mittellinie selbst
      expect(d).toBeLessThanOrEqual(half + 0.5);
      // und mit Abstand zur Mittellinie (Gegenspur), nie auf der gestrichelten Linie
      expect(d).toBeGreaterThanOrEqual(half * 0.2);
    }
    // Mittelwert der Abstände liegt in der Spurmitte-Gegend (~ halbe Fahrbahnhälfte), nicht am Rand
    const avg = g.linePts.reduce((s, p) => s + distToPolyline(p, g.centerPts), 0) / g.linePts.length;
    expect(avg).toBeGreaterThan(half * 0.2);
    expect(avg).toBeLessThan(half * 0.9);
  });
});

describe('Fahrerposition und Stufenzahl', () => {
  const c = detectCurves(new TrackBuilder().straight(150).arc('left', 60, 90).straight(150).latLon()).curves[0]!;

  it('Fahrer wandert mit dem Fortschritt entlang der Linie', () => {
    const far = buildRoadGraphic(c, 360, 360, 36, -500);
    const atStart = buildRoadGraphic(c, 360, 360, 36, 0);
    const inside = buildRoadGraphic(c, 360, 360, 36, 40);
    expect(far.rider).toEqual(far.linePts[0]);
    // am Kurvenanfang liegt der Fahrer weiter oben (kleineres y) als am Geometrieanfang
    expect(atStart.rider.y).toBeLessThan(far.rider.y);
    expect(inside.rider.y).toBeLessThan(atStart.rider.y + 1);
    // die restliche Linie beginnt an der Fahrerposition
    const m = inside.line.match(/M(-?[\d.]+) (-?[\d.]+)/)!;
    expect(Number(m[1])).toBeCloseTo(inside.rider.x, 0);
    expect(Number(m[2])).toBeCloseTo(inside.rider.y, 0);
  });

  it('Stufenzahl liegt weit weg von der Straße', () => {
    const g = buildRoadGraphic(c, 360, 360, 36);
    const center = { x: g.numberAnchor.x, y: g.numberAnchor.y - 35 };
    const d = Math.min(...g.centerPts.map((p) => Math.hypot(p.x - center.x, p.y - center.y)));
    expect(d).toBeGreaterThan(40);
  });
});

import { amplitudeForAngle, toPath } from '../../src/components/curveGraphicMath';

describe('Auslenkung und Pfade', () => {
  it('sanfte Kurven bekommen eine flachere Fahrlinie als enge', () => {
    expect(amplitudeForAngle(30)).toBeLessThan(amplitudeForAngle(90));
    expect(amplitudeForAngle(5)).toBeGreaterThan(0);
    expect(amplitudeForAngle(180)).toBeCloseTo(LINE_AMPLITUDE, 9);
  });

  it('toPath liefert glatte Bézier-Pfade, die an Anfang und Ende der Punkte liegen', () => {
    const d = toPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 10 }, { x: 30, y: 10 }]);
    expect(d.startsWith('M0.0 0.0')).toBe(true);
    expect(d).toContain('Q');
    expect(d.endsWith('30.0 10.0')).toBe(true);
    expect(toPath([{ x: 1, y: 2 }, { x: 3, y: 4 }])).toBe('M1.0 2.0 L3.0 4.0');
  });
});
