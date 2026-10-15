import type { Curve } from './curves';
import { translate, type Lang } from './i18n/translate';
import type { Units } from './settings';

const M_TO_FT = 3.28084;
const MS_TO_KMH = 3.6;
const MS_TO_MPH = 2.23694;

/** Dezimalzahl mit Komma (Deutsch) bzw. Punkt (Englisch). */
const dec = (n: number, lang: Lang, digits = 1) => (lang === 'de' ? n.toFixed(digits).replace('.', ',') : n.toFixed(digits));

/** Streckenlänge: km bzw. Meilen. */
export function formatKm(m: number, units: Units = 'metric', lang: Lang = 'de'): string {
  return units === 'metric' ? `${dec(m / 1000, lang)} km` : `${dec((m * M_TO_FT) / 5280, lang)} mi`;
}

/** Distanz entlang der Route: metrisch unter 1 km in m, sonst km; imperial unter 1000 ft in ft, sonst Meilen. */
export function formatDistance(m: number, units: Units = 'metric', lang: Lang = 'de'): string {
  if (units === 'metric') return m < 1000 ? `${Math.round(m)} m` : formatKm(m, 'metric', lang);
  const ft = m * M_TO_FT;
  return ft < 1000 ? `${Math.round(ft / 10) * 10} ft` : formatKm(m, 'imperial', lang);
}

export function formatSpeed(ms: number, units: Units = 'metric'): string {
  return units === 'metric' ? `${Math.round(ms * MS_TO_KMH)} km/h` : `${Math.round(ms * MS_TO_MPH)} mph`;
}

/** Kurzer Radius, z. B. „R 55 m" bzw. „R 180 ft". */
export function formatRadius(m: number, units: Units = 'metric'): string {
  return units === 'metric' ? `R ${Math.round(m)} m` : `R ${Math.round(m * M_TO_FT)} ft`;
}

export const directionLabel = (d: Curve['direction'], lang: Lang = 'de') =>
  translate(lang, d === 'left' ? 'dir.left' : 'dir.right');

export const shapeLabel = (s: Curve['shape'], lang: Lang = 'de') =>
  s === 'tightening' ? translate(lang, 'shape.tightening') : s === 'opening' ? translate(lang, 'shape.opening') : '';
