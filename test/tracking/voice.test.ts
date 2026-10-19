import { detectCurves } from '../../src/curves';
import { AnnounceScheduler, announceSettingsFrom, leadDistance, DEFAULT_ANNOUNCE_SETTINGS } from '../../src/voice/announceScheduler';
import { DEFAULT_PHRASE_OPTIONS, announcementText, spokenDistance, systemPhrase } from '../../src/voice/phrases';
import { TrackBuilder } from '../curves/helpers';

const t = new TrackBuilder()
  .straight(300)
  .arc('right', 60, 60)
  .arc('left', 60, 60) // direkte Folge
  .straight(400)
  .arc('left', 12, 150) // Spitzkehre
  .straight(200);
const { curves } = detectCurves(t.latLon());

describe('Vorlauf', () => {
  it('mindestens 80 m, sonst 6 s Geschwindigkeit', () => {
    expect(leadDistance(5, DEFAULT_ANNOUNCE_SETTINGS)).toBe(80);
    expect(leadDistance(25, DEFAULT_ANNOUNCE_SETTINGS)).toBe(150);
  });
});

describe('Phrasen', () => {
  it('rundet Distanzen sprechbar', () => {
    expect(spokenDistance(84)).toBe(80);
    expect(spokenDistance(237)).toBe(240);
    expect(spokenDistance(412)).toBe(400);
  });
  it('Spitzkehre und Folge', () => {
    expect(curves).toHaveLength(3);
    expect(announcementText(curves[2]!, 100)).toContain('Spitzkehre links');
    const txt = announcementText(curves[0]!, 150, [curves[1]!]);
    expect(txt).toMatch(/^In 150 Metern Rechts \d/);
    expect(txt).toContain('danach links');
  });
});

describe('Kurze Ansagen (Schalter)', () => {
  const base = { ...DEFAULT_PHRASE_OPTIONS, language: 'de', style: 'long', shape: true, units: 'metric' } as const;
  const strong = { direction: 'right', grade: 3, shape: 'tightening', curvatureChange: 3 } as const;
  const mild = { direction: 'right', grade: 3, shape: 'tightening', curvatureChange: 1.5 } as const;

  it('announceSettingsFrom: der Schalter erzwingt den kurzen Stil, ohne den gewählten Stil zu verändern', () => {
    const on = announceSettingsFrom({ ...DEFAULT_DRIVE_SETTINGS, announceStyle: 'long', shortAnnouncements: true });
    expect(on.phrase.style).toBe('short');
    const off = announceSettingsFrom({ ...DEFAULT_DRIVE_SETTINGS, announceStyle: 'long', shortAnnouncements: false });
    expect(off.phrase.style).toBe('long');
    expect(DEFAULT_DRIVE_SETTINGS.shortAnnouncements).toBe(false);
  });

  it('kein Vorlauftext: nur Richtung und Stufe', () => {
    expect(announcementText({ direction: 'left', grade: 4, shape: 'constant' }, 237, [], { ...base, style: 'short' })).toBe('Links 4');
  });

  it('deutlich zuziehend behält „zieht zu“ auch kurz, leicht zuziehend nicht', () => {
    expect(announcementText(strong, 237, [], { ...base, style: 'short' })).toBe('Rechts 3, zieht zu');
    expect(announcementText(mild, 237, [], { ...base, style: 'short' })).toBe('Rechts 3');
    expect(announcementText(strong, 237, [], { ...base, style: 'short', language: 'en' })).toBe('Right 3, tightening');
  });

  it('Folgekurven bleiben kurz', () => {
    expect(announcementText(strong, 237, [{ direction: 'left', grade: 4, shape: 'tightening', curvatureChange: 3 }], { ...base, style: 'short' })).toBe(
      'Rechts 3, zieht zu, danach links 4',
    );
  });

  it('unsichere Kurve bleibt „Kurve, unsicher“', () => {
    expect(announcementText({ ...strong, confidence: 0.1 }, 237, [], { ...base, style: 'short' })).toBe('Kurve, unsicher');
  });
});

describe('Unsichere Kurven', () => {
  const uncertain = { ...curves[0]!, confidence: 0.2 };
  const sure = { ...curves[0]!, confidence: 0.9 };
  it('sagt „Kurve, unsicher" statt der Stufe', () => {
    const txt = announcementText(uncertain, 150);
    expect(txt).toBe('In 150 Metern Kurve, unsicher');
    expect(txt).not.toMatch(/\d$/);
    expect(announcementText(sure, 150)).toMatch(/Rechts \d/);
  });
  it('englisch und im kurzen Stil', () => {
    const en = { language: 'en', style: 'short', shape: false, units: 'metric' } as const;
    expect(announcementText(uncertain, 150, [], en)).toBe('Curve, uncertain');
  });
  it('unsichere Folgekurve wird ebenfalls ohne Stufe genannt', () => {
    const txt = announcementText(sure, 150, [{ ...curves[1]!, confidence: 0.1 }]);
    expect(txt).toContain('danach kurve, unsicher');
  });
  it('Hinweise zur Vorschau', () => {
    expect(systemPhrase('noPreview', 'de')).toBe('Keine Vorschau');
    expect(systemPhrase('previewBack', 'de')).toBe('Vorschau wieder da');
    expect(systemPhrase('noPreview', 'en')).toBe('No preview');
    expect(systemPhrase('previewBack', 'en')).toBe('Preview back');
  });
});

describe('AnnounceScheduler', () => {
  it('sagt erst innerhalb des Vorlaufs an, jede Kurve nur einmal', () => {
    const s = new AnnounceScheduler(curves);
    const start = curves[0]!.startDist;
    expect(s.next(start - 400, 15)).toBeNull();
    const a = s.next(start - 85, 15);
    expect(a?.curveIndex).toBe(curves[0]!.index);
    expect(s.next(start - 80, 15)).toBeNull();
  });

  it('fasst Kurvenfolgen in einer Ansage zusammen', () => {
    const s = new AnnounceScheduler(curves);
    const a = s.next(curves[0]!.startDist - 75, 10)!;
    expect(a.text).toContain('danach');
    // Folgekurve wird nicht noch einmal einzeln angesagt
    expect(s.next(curves[1]!.startDist - 60, 10)).toBeNull();
  });

  it('höhere Geschwindigkeit sagt früher an', () => {
    const slow = new AnnounceScheduler(curves).next(curves[2]!.startDist - 120, 10);
    const fast = new AnnounceScheduler(curves).next(curves[2]!.startDist - 120, 30);
    expect(slow).toBeNull();
    expect(fast).not.toBeNull();
  });

  it('überspringt Kurven, die zu spät erreicht werden', () => {
    const s = new AnnounceScheduler(curves);
    expect(s.next(curves[2]!.startDist - 10, 10)).toBeNull();
  });
});

import { DEFAULT_DRIVE_SETTINGS } from '../../src/settings';
import { distancePhrase, exampleAnnouncement, curvePhrase } from '../../src/voice/phrases';
import { formatDistance, formatKm, formatRadius, formatSpeed } from '../../src/format';

describe('Ansage-Stile und Sprachen', () => {
  const a = { direction: 'right', grade: 3, shape: 'tightening' } as const;
  const b = { direction: 'left', grade: 4, shape: 'constant' } as const;
  const base = { language: 'de', style: 'long', shape: true, units: 'metric' } as const;

  it('deutsch lang und kurz', () => {
    expect(announcementText(a, 237, [b], base)).toBe('In 240 Metern Rechts 3, zieht zu, danach links 4');
    expect(announcementText(a, 237, [b], { ...base, style: 'short' })).toBe('Rechts 3, danach links 4');
    expect(announcementText(a, 237, [], { ...base, shape: false })).toBe('In 240 Metern Rechts 3');
  });

  it('englisch', () => {
    const en = { ...base, language: 'en' } as const;
    expect(announcementText(a, 237, [b], en)).toBe('In 240 meters Right 3, tightening, then left 4');
    expect(curvePhrase({ direction: 'left', grade: 1, shape: 'constant' }, true, 'en')).toBe('Hairpin left');
    expect(announcementText(a, 237, [], { ...en, style: 'short' })).toBe('Right 3');
  });

  it('imperial: Fuß/feet und Meilen', () => {
    expect(distancePhrase(80, 'imperial', 'en')).toBe('In 250 feet');
    expect(distancePhrase(80, 'imperial', 'de')).toBe('In 250 Fuß');
    expect(distancePhrase(805, 'imperial', 'en')).toBe('In 0.5 miles');
    expect(distancePhrase(805, 'imperial', 'de')).toBe('In 0,5 Meilen');
  });

  it('Beispielansage folgt den Einstellungen', () => {
    expect(exampleAnnouncement(base)).toContain('danach links 4');
    expect(exampleAnnouncement({ ...base, style: 'short' })).not.toContain('Metern');
  });

  it('announceSettingsFrom übernimmt die Benutzereinstellungen', () => {
    const s = announceSettingsFrom({ ...DEFAULT_DRIVE_SETTINGS, announceStyle: 'short', voiceLanguage: 'en', units: 'imperial', minAnnounceGrade: 3 });
    expect(s.minAnnounceGrade).toBe(3);
    expect(s.phrase).toEqual({ language: 'en', style: 'short', shape: true, units: 'imperial' });
  });
});

describe('Filter für leichte Kurven', () => {
  // A: Rechts (Stufe 3), direkt danach B: Links (Stufe 6, leicht) = Folge; C: leicht und allein; D: Links (Stufe 3)
  const route = new TrackBuilder()
    .straight(200).arc('right', 40, 80).arc('left', 250, 40)
    .straight(300).arc('right', 250, 40)
    .straight(300).arc('left', 40, 80).straight(200);
  const { curves: cs } = detectCurves(route.latLon());

  function announce(minGrade: number) {
    const s = new AnnounceScheduler(cs, { ...DEFAULT_ANNOUNCE_SETTINGS, minAnnounceGrade: minGrade });
    const out: string[] = [];
    for (let d = 0; d < 1300; d += 10) {
      const a = s.next(d, 15);
      if (a) out.push(a.text);
    }
    return out;
  }

  it('Voraussetzung: vier Kurven, B folgt auf A, C steht allein', () => {
    expect(cs.map((c) => `${c.direction}${c.grade}`)).toEqual(['right3', 'left6', 'right6', 'left3']);
    expect(cs[1]!.followsPrevious).toBe(true);
    expect(cs[2]!.followsPrevious).toBe(false);
  });

  it('ab Stufe 4: leichte Einzelkurve entfällt, leichte Folgekurve wird mitgenannt', () => {
    const out = announce(4);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatch(/Rechts 3.*danach links 6/);
    expect(out[1]).toMatch(/Links 3/);
  });

  it('bei Stufe 6 werden alle Kurven angesagt', () => {
    expect(announce(6)).toHaveLength(3);
  });

  it('bei Stufe 2 entfällt alles außer Spitzkehren und sehr engen Kurven', () => {
    expect(announce(2)).toHaveLength(0);
  });
});

describe('Einheiten in der Anzeige', () => {
  it('metrisch und imperial', () => {
    expect(formatDistance(240)).toBe('240 m');
    expect(formatDistance(240, 'imperial')).toBe('790 ft');
    expect(formatDistance(1500, 'imperial')).toBe('0,9 mi');
    expect(formatKm(29700, 'imperial')).toBe('18,5 mi');
    expect(formatSpeed(15, 'metric')).toBe('54 km/h');
    expect(formatSpeed(15, 'imperial')).toBe('34 mph');
    expect(formatRadius(55, 'imperial')).toBe('R 180 ft');
  });
});
