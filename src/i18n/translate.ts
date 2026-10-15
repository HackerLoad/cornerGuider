import { de, en, type TextKey } from './dictionary';

export type Lang = 'de' | 'en';
export type UiLanguageSetting = 'auto' | Lang;
export type { TextKey };

const DICTS: Record<Lang, Record<TextKey, string>> = { de, en };

/** „auto" folgt der Gerätesprache; alles außer Deutsch wird Englisch (Fallback Deutsch ohne Angabe). */
export function resolveLanguage(setting: UiLanguageSetting, deviceLocale?: string | null): Lang {
  if (setting !== 'auto') return setting;
  const l = (deviceLocale ?? '').toLowerCase();
  if (!l) return 'de';
  return l.startsWith('de') ? 'de' : 'en';
}

export type Params = Record<string, string | number>;

/** Setzt {platzhalter} ein; unbekannte Platzhalter bleiben sichtbar (fällt in Tests auf). */
export function translate(lang: Lang, key: TextKey, params?: Params): string {
  const text = DICTS[lang][key];
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

/** Mehrzahl über die Schlüssel `<base>.one` und `<base>.other` (Deutsch und Englisch: nur 1 ist Einzahl). */
export function translatePlural(lang: Lang, base: 'n.curves', count: number, params: Params = {}): string {
  const key = `${base}.${count === 1 ? 'one' : 'other'}` as TextKey;
  return translate(lang, key, { count, ...params });
}

/** Platzhalter eines Textes, z. B. für den Paritätstest. */
export function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();
}
