import { translate, type Lang } from './i18n/translate';
import type { TextKey } from './i18n/dictionary';

/**
 * Fehler mit Schlüssel für die Anzeige in der Sprache der App (die Kernmodule kennen die Sprache nicht).
 * Parameter, deren Name auf „Key" endet (z. B. `reasonKey`), werden selbst übersetzt und als `reason` eingesetzt.
 */
function resolve(lang: Lang, key: TextKey, raw: Record<string, string | number>): string {
  const params: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.endsWith('Key')) params[k.slice(0, -3)] = translate(lang, v as TextKey);
    else params[k] = v;
  }
  return translate(lang, key, params);
}

export class AppError extends Error {
  constructor(
    readonly key: TextKey,
    readonly params: Record<string, string | number> = {},
    /** Deutscher Text für Logs und Tests */
    message: string = resolve('de', key, params),
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorMessage(e: unknown, lang: Lang): string {
  if (e instanceof AppError) return resolve(lang, e.key, e.params);
  return e instanceof Error ? e.message : String(e);
}
