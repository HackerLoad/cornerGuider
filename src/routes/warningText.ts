import type { TextKey } from '../i18n/dictionary';
import type { RouteWarning } from './model';

type Tr = (key: TextKey, params?: Record<string, string | number>) => string;

/** Text eines Importhinweises in der Sprache der App. Ältere Strecken enthalten noch fertigen Text. */
export function warningText(w: RouteWarning | string, t: Tr, dist: (m: number) => string): string {
  if (typeof w === 'string') return w;
  switch (w.code) {
    case 'sparse':
      return t('warn.sparse', { spacing: dist(w.spacingM) });
    case 'routeNoTrack':
      return t('warn.routeNoTrack');
    case 'noCurves':
      return t('warn.noCurves');
  }
}
