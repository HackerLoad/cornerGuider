import type { Curve } from './curves';

export function formatKm(m: number): string {
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Distanz entlang der Route: unter 1 km in m, sonst in km. */
export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : formatKm(m);
}

export const directionLabel = (d: Curve['direction']) => (d === 'left' ? 'Links' : 'Rechts');

export const shapeLabel = (s: Curve['shape']) =>
  s === 'tightening' ? 'zieht zu' : s === 'opening' ? 'öffnet' : '';
