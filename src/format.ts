import type { Curve } from './curves';
import type { Units } from './settings';

const M_TO_FT = 3.28084;
const MS_TO_KMH = 3.6;
const MS_TO_MPH = 2.23694;

const dec = (n: number, digits = 1) => n.toFixed(digits).replace('.', ',');

/** Streckenlänge: km bzw. Meilen. */
export function formatKm(m: number, units: Units = 'metric'): string {
  return units === 'metric' ? `${dec(m / 1000)} km` : `${dec((m * M_TO_FT) / 5280)} mi`;
}

/** Distanz entlang der Route: metrisch unter 1 km in m, sonst km; imperial unter 0,2 mi in ft, sonst Meilen. */
export function formatDistance(m: number, units: Units = 'metric'): string {
  if (units === 'metric') return m < 1000 ? `${Math.round(m)} m` : formatKm(m);
  const ft = m * M_TO_FT;
  return ft < 1000 ? `${Math.round(ft / 10) * 10} ft` : formatKm(m, 'imperial');
}

export function formatSpeed(ms: number, units: Units = 'metric'): string {
  return units === 'metric' ? `${Math.round(ms * MS_TO_KMH)} km/h` : `${Math.round(ms * MS_TO_MPH)} mph`;
}

/** Kurzer Radius, z. B. „R 55 m" bzw. „R 180 ft". */
export function formatRadius(m: number, units: Units = 'metric'): string {
  return units === 'metric' ? `R ${Math.round(m)} m` : `R ${Math.round(m * M_TO_FT)} ft`;
}

export const directionLabel = (d: Curve['direction']) => (d === 'left' ? 'Links' : 'Rechts');

export const shapeLabel = (s: Curve['shape']) =>
  s === 'tightening' ? 'zieht zu' : s === 'opening' ? 'öffnet' : '';
