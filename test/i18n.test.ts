import { de, en, type TextKey } from '../src/i18n/dictionary';
import { AppError, errorMessage } from '../src/errors';
import { formatDistance, formatKm, directionLabel, shapeLabel } from '../src/format';
import { placeholders, resolveLanguage, translate, translatePlural } from '../src/i18n/translate';
import { toLiveContent } from '../src/liveActivity/model';
import { systemPhrase } from '../src/voice/phrases';

const keys = Object.keys(de) as TextKey[];

describe('Wörterbuch', () => {
  it('Deutsch und Englisch haben dieselben Schlüssel und Platzhalter', () => {
    expect(Object.keys(en).sort()).toEqual([...keys].sort());
    for (const k of keys) {
      expect(placeholders(en[k])).toEqual(placeholders(de[k]));
    }
  });

  it('kein Text ist leer, und Englisch ist nicht einfach Deutsch kopiert', () => {
    // in beiden Sprachen gleich lautende Texte (Fremdwörter, Einheiten, Satzbau mit Platzhaltern)
    const allowed = new Set<TextKey>([
      'set.units.metric', 'set.units.imperial', 'route.title', 'tabs.go', 'import.title', 'live.dirGrade',
      'go.simulation', 'drive.in', 'sim.label', 'sim.pause', 'result.distanceTime', 'live.in', 'fb.markItem',
    ]);
    expect(keys.filter((k) => en[k] === de[k] && !allowed.has(k))).toEqual([]);
    for (const k of keys) {
      expect(de[k].trim()).not.toBe('');
      expect(en[k].trim()).not.toBe('');
    }
  });
});

describe('translate', () => {
  it('setzt Platzhalter ein und lässt unbekannte stehen', () => {
    expect(translate('de', 'drive.in', { distance: '240 m' })).toBe('In 240 m');
    expect(translate('en', 'drive.speedRest', { speed: '54 km/h', rest: '3 km' })).toBe('54 km/h · 3 km left');
    expect(translate('de', 'drive.in')).toBe('In {distance}');
  });

  it('Mehrzahl', () => {
    expect(translatePlural('de', 'n.curves', 1)).toBe('1 Kurve');
    expect(translatePlural('de', 'n.curves', 235)).toBe('235 Kurven');
    expect(translatePlural('en', 'n.curves', 1)).toBe('1 curve');
    expect(translatePlural('en', 'n.curves', 0)).toBe('0 curves');
  });

  it('Gerätesprache: auto folgt dem Gerät, sonst Deutsch/Englisch', () => {
    expect(resolveLanguage('auto', 'de-DE')).toBe('de');
    expect(resolveLanguage('auto', 'de-AT')).toBe('de');
    expect(resolveLanguage('auto', 'en-US')).toBe('en');
    expect(resolveLanguage('auto', 'fr-FR')).toBe('en');
    expect(resolveLanguage('auto', null)).toBe('de');
    expect(resolveLanguage('en', 'de-DE')).toBe('en');
    expect(resolveLanguage('de', 'en-US')).toBe('de');
  });
});

describe('Formate nach Sprache', () => {
  it('Dezimalkomma bzw. Dezimalpunkt', () => {
    expect(formatKm(29700, 'metric', 'de')).toBe('29,7 km');
    expect(formatKm(29700, 'metric', 'en')).toBe('29.7 km');
    expect(formatDistance(1500, 'imperial', 'en')).toBe('0.9 mi');
  });
  it('Richtung und Form', () => {
    expect(directionLabel('left', 'de')).toBe('Links');
    expect(directionLabel('left', 'en')).toBe('Left');
    expect(shapeLabel('tightening', 'en')).toBe('tightens');
    expect(shapeLabel('constant', 'en')).toBe('');
  });
});

describe('Fehler und Systemtexte', () => {
  it('AppError wird in der Sprache der App angezeigt, die Meldung bleibt deutsch', () => {
    const e = new AppError('err.roadData', { attempts: 4, reasonKey: 'err.timeout' });
    expect(e.message).toContain('Zeitüberschreitung');
    expect(errorMessage(e, 'en')).toBe('Road data unavailable (4 attempts): Timeout');
    expect(errorMessage(new Error('boom'), 'en')).toBe('boom');
  });
  it('gesprochene Systemtexte', () => {
    expect(systemPhrase('offRoute', 'en')).toBe('Off route');
    expect(systemPhrase('finished', 'de')).toBe('Ziel erreicht');
  });
  it('Live-Aktivität in beiden Sprachen', () => {
    const input = { kind: 'curve', direction: 'right', grade: 1, distanceM: 90 } as const;
    expect(toLiveContent(input, 'metric', 'de').title).toBe('Spitzkehre rechts');
    expect(toLiveContent(input, 'metric', 'en')).toMatchObject({ title: 'Hairpin right', subtitle: 'In 90 m' });
    expect(toLiveContent({ kind: 'offRoute' }, 'metric', 'en').title).toBe('Off route');
  });
});
