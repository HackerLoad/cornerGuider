export interface GpsProfile {
  accuracy: 'best' | 'balanced';
  /** Mindestabstand zwischen Updates (ms) */
  timeIntervalMs: number;
  distanceIntervalM: number;
}

const MOVING: GpsProfile = { accuracy: 'best', timeIntervalMs: 1000, distanceIntervalM: 0 };
const STANDING: GpsProfile = { accuracy: 'balanced', timeIntervalMs: 3000, distanceIntervalM: 5 };

/** Im Stand sparsamer orten, in Bewegung 1 Hz mit bester Genauigkeit. */
export function gpsProfileForSpeed(speedMs: number | null): GpsProfile {
  return (speedMs ?? 0) < 1 ? STANDING : MOVING;
}

export function sameProfile(a: GpsProfile, b: GpsProfile): boolean {
  return a.accuracy === b.accuracy && a.timeIntervalMs === b.timeIntervalMs && a.distanceIntervalM === b.distanceIntervalM;
}
