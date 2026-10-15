import { directionLabel, formatDistance, formatKm, formatRadius, formatSpeed, shapeLabel } from '../format';
import { useSettingsStore } from '../stores/settingsStore';
import { resolveLanguage, translate, translatePlural, type Lang, type Params, type TextKey } from './translate';

export type { Lang, TextKey };

/** Gerätesprache, z. B. „de-DE". Hermes liefert sie über Intl. */
function deviceLocale(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return null;
  }
}

/** Aktuelle Sprache der App (außerhalb von React, z. B. für Alerts und Fehlertexte). */
export function currentLanguage(): Lang {
  return resolveLanguage(useSettingsStore.getState().uiLanguage, deviceLocale());
}

/** Text in der aktuellen Sprache. In Komponenten zusätzlich `useLanguage()` nutzen, damit sie bei einem Wechsel neu zeichnen. */
export function t(key: TextKey, params?: Params): string {
  return translate(currentLanguage(), key, params);
}

export function tn(base: 'n.curves', count: number, params?: Params): string {
  return translatePlural(currentLanguage(), base, count, params);
}

/** Abonniert die Spracheinstellung (löst bei Wechsel ein Neuzeichnen aus) und liefert die Sprache. */
export function useLanguage(): Lang {
  const setting = useSettingsStore((s) => s.uiLanguage);
  return resolveLanguage(setting, deviceLocale());
}

/** Alles für die Anzeige in einem Aufruf: Sprache, Einheiten und daran gebundene Textfunktionen. */
export function useFormat() {
  const lang = useLanguage();
  const units = useSettingsStore((s) => s.units);
  return {
    lang,
    units,
    t: (key: TextKey, params?: Params) => translate(lang, key, params),
    tn: (count: number, params?: Params) => translatePlural(lang, 'n.curves', count, params),
    dist: (m: number) => formatDistance(m, units, lang),
    km: (m: number) => formatKm(m, units, lang),
    speed: (ms: number) => formatSpeed(ms, units),
    radius: (m: number) => formatRadius(m, units),
    dir: (d: 'left' | 'right') => directionLabel(d, lang),
    shape: (s: 'tightening' | 'opening' | 'constant') => shapeLabel(s, lang),
  };
}
