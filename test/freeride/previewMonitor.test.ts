import { PreviewMonitor } from '../../src/freeride/previewMonitor';

const good = { ok: true, aheadM: 600, leadM: 100, speedMs: 15 };
const bad = { ok: true, aheadM: 20, leadM: 100, speedMs: 15 };

describe('PreviewMonitor', () => {
  it('meldet den Abbruch genau einmal, nicht bei jedem Schritt', () => {
    const m = new PreviewMonitor({ lostAfter: 3, backAfter: 3 });
    expect(m.update(good)).toBeNull();
    const events = Array.from({ length: 20 }, () => m.update(bad)).filter(Boolean);
    expect(events).toEqual(['lost']);
  });

  it('meldet „wieder da" erst nach mehreren guten Schritten, ebenfalls einmal', () => {
    const m = new PreviewMonitor({ lostAfter: 2, backAfter: 3 });
    m.update(good);
    m.update(bad);
    expect(m.update(bad)).toBe('lost');
    expect(m.update(good)).toBeNull();
    expect(m.update(good)).toBeNull();
    expect(m.update(good)).toBe('back');
    expect(Array.from({ length: 10 }, () => m.update(good)).filter(Boolean)).toEqual([]);
  });

  it('kurze Aussetzer lösen nichts aus', () => {
    const m = new PreviewMonitor({ lostAfter: 3, backAfter: 3 });
    m.update(good);
    const seq = [bad, bad, good, bad, bad, good, good, good];
    expect(seq.map((s) => m.update(s)).filter(Boolean)).toEqual([]);
  });

  it('vor der ersten guten Vorschau gibt es keinen Abbruch', () => {
    const m = new PreviewMonitor({ lostAfter: 2, backAfter: 2 });
    expect(Array.from({ length: 10 }, () => m.update({ ok: false, aheadM: 0, leadM: 100, speedMs: 15 })).filter(Boolean)).toEqual([]);
  });

  it('im Stand wird nichts gezählt (Ampel)', () => {
    const m = new PreviewMonitor({ lostAfter: 2, backAfter: 2 });
    m.update(good);
    const stopped = { ...bad, speedMs: 0 };
    expect(Array.from({ length: 10 }, () => m.update(stopped)).filter(Boolean)).toEqual([]);
  });

  it('unsichere Zuordnung (ok = false) zählt als Abbruch', () => {
    const m = new PreviewMonitor({ lostAfter: 2, backAfter: 2 });
    m.update(good);
    m.update({ ...good, ok: false });
    expect(m.update({ ...good, ok: false })).toBe('lost');
  });

  it('reset vergisst den Zustand', () => {
    const m = new PreviewMonitor({ lostAfter: 1, backAfter: 1 });
    m.update(good);
    expect(m.update(bad)).toBe('lost');
    m.reset();
    expect(m.update(bad)).toBeNull();
  });
});
