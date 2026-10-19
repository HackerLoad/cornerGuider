import { detectCurves } from '../../src/curves';
import { DEFAULT_CURVE_CONFIG } from '../../src/curves/config';
import { isStrongTightening } from '../../src/curves/classify';
import { DEFAULT_ANNOUNCE_SETTINGS, AnnounceScheduler } from '../../src/voice/announceScheduler';
import { TrackBuilder } from './helpers';

const cfg = DEFAULT_CURVE_CONFIG;
const one = (t: TrackBuilder) => {
  const { curves } = detectCurves(t.latLon());
  expect(curves).toHaveLength(1);
  return curves[0]!;
};

/** Stufenweise Spirale: Radien nacheinander, je mit gleichem Bogenwinkel. */
const spiral = (dir: 'left' | 'right', radii: number[], angleEach: number) => {
  const t = new TrackBuilder().straight(150);
  radii.forEach((r) => t.arc(dir, r, angleEach));
  return t.straight(150);
};

describe('Form der Kurve: konstant, zieht zu, öffnet', () => {
  it('Kreisbogen → konstant, Änderung ≈ 1', () => {
    const c = one(new TrackBuilder().straight(150).arc('right', 60, 120).straight(150));
    expect(c.shape).toBe('constant');
    expect(c.curvatureChange).toBeGreaterThan(0.85);
    expect(c.curvatureChange).toBeLessThan(1.15);
  });

  it('Spirale mit abnehmendem Radius → zieht zu', () => {
    const c = one(spiral('right', [160, 110, 75, 50], 25));
    expect(c.shape).toBe('tightening');
    expect(c.curvatureChange).toBeGreaterThan(cfg.shapeRatio);
    expect(c.direction).toBe('right');
  });

  it('Spirale mit zunehmendem Radius → öffnet sich', () => {
    const c = one(spiral('left', [50, 75, 110, 160], 25));
    expect(c.shape).toBe('opening');
    expect(c.curvatureChange).toBeLessThan(1 / cfg.shapeRatio);
    expect(c.direction).toBe('left');
  });

  it('zuziehende und öffnende Spirale haben dieselbe Stufe (engster Punkt zählt, nicht die Einfahrt)', () => {
    const tight = one(spiral('right', [160, 110, 75, 50], 25));
    const open = one(spiral('right', [50, 75, 110, 160], 25));
    expect(tight.grade).toBe(open.grade);
    expect(tight.grade).toBeLessThanOrEqual(3); // R=50 → 42 m nach Abschlag
  });
});

describe('engster Punkt in der Mitte → kein Trend', () => {
  it('zieht zu und geht wieder auf (160 → 50 → 160) gilt nicht als „zieht zu"', () => {
    const c = one(spiral('right', [160, 110, 75, 50, 50, 75, 110, 160], 15));
    expect(c.shape).toBe('constant');
    expect(isStrongTightening(c, cfg)).toBe(false);
  });

  it('asymmetrisch wie Stelvio #2 (R 300 → 110 in der Mitte → 170) ist kein „zieht zu"', () => {
    const c = one(spiral('right', [300, 200, 110, 110, 150, 170], 15));
    expect(c.curvatureChange).toBeGreaterThan(cfg.shapeRatio); // Anfang gegen Ende allein sähe nach „zieht zu" aus
    expect(c.shape).toBe('constant');
    expect(isStrongTightening(c, cfg)).toBe(false);
  });

  it('zieht zu und bleibt eng bis zum Ende zählt weiterhin als „zieht zu"', () => {
    const c = one(spiral('left', [160, 110, 75, 50, 50], 20));
    expect(c.shape).toBe('tightening');
  });

  it('öffnet sich nach dem engen Anfang zählt als „öffnet"; weitet sich erst spät auf nicht', () => {
    expect(one(spiral('right', [50, 50, 75, 110, 160], 20)).shape).toBe('opening');
    expect(one(spiral('right', [160, 110, 75, 50, 75, 110, 160], 15)).shape).toBe('constant');
  });
});

describe('deutlich zuziehend', () => {
  it('Spirale 160 → 50 ist deutlich zuziehend, leicht zuziehende nicht', () => {
    const strong = one(spiral('right', [160, 110, 75, 50], 25));
    expect(isStrongTightening(strong, cfg)).toBe(true);
    const mild = one(spiral('right', [100, 85, 70], 30));
    expect(mild.shape).toBe('tightening');
    expect(isStrongTightening(mild, cfg)).toBe(false);
  });

  it('sehr leichte Kurve (Stufe 6) gilt auch zuziehend nicht als bevorzugt', () => {
    const c = one(spiral('left', [380, 250, 170], 15));
    expect(c.grade).toBe(6);
    expect(c.shape).toBe('tightening');
    expect(isStrongTightening(c, cfg)).toBe(false);
  });
});

describe('Ansagefilter lässt deutlich zuziehende Kurven durch', () => {
  const announce = (t: TrackBuilder, minGrade: number) => {
    const curves = detectCurves(t.latLon()).curves;
    const s = new AnnounceScheduler(curves, { ...DEFAULT_ANNOUNCE_SETTINGS, minAnnounceGrade: minGrade });
    const out: string[] = [];
    for (let d = 0; d < 1500; d += 10) {
      const a = s.next(d, 15);
      if (a) out.push(a.text);
    }
    return { curves, out };
  };

  it('zieht deutlich zu → wird trotz Filter angesagt, mit „zieht zu"', () => {
    const t = spiral('right', [160, 110, 75, 50], 25);
    const c = detectCurves(t.latLon()).curves[0]!;
    const filter = c.grade - 1; // normale Kurve dieser Stufe fiele durch den Filter
    const { out } = announce(t, filter);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('zieht zu');
  });

  it('gleiche Stufe, aber konstant → bleibt durch den Filter unterdrückt', () => {
    const tight = detectCurves(spiral('right', [160, 110, 75, 50], 25).latLon()).curves[0]!;
    const t = new TrackBuilder().straight(150).arc('right', 50, 100).straight(150);
    const c = detectCurves(t.latLon()).curves[0]!;
    expect(c.grade).toBe(tight.grade);
    expect(announce(t, c.grade - 1).out).toHaveLength(0);
  });

  it('leicht zuziehend und sehr leicht (Stufe 6) bleiben filterbar', () => {
    const mild = spiral('right', [100, 85, 70], 30);
    const mc = detectCurves(mild.latLon()).curves[0]!;
    expect(announce(mild, mc.grade - 1).out).toHaveLength(0);
    const sweeper = spiral('left', [380, 250, 170], 15);
    expect(announce(sweeper, 5).out).toHaveLength(0);
  });
});
