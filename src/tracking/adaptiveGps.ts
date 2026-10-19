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

const STANDING_BEFORE_ECO_MS = 20_000;

/**
 * Entscheidet, wann die Ortung umgestellt wird: In Fahrt immer 1 Hz mit bester Genauigkeit (die Vorschau
 * braucht das), nach 20 s Stand sparsam. Liefert nur bei einem Wechsel ein Profil, sonst null.
 */
export class GpsAdapter {
  private profile: GpsProfile | null = null;
  private standingSince: number | null = null;

  update(speedMs: number | null, now: number): GpsProfile | null {
    const speed = speedMs ?? 0;
    if (speed >= 1) this.standingSince = null;
    else this.standingSince ??= now;
    const standingLongEnough = this.standingSince !== null && now - this.standingSince >= STANDING_BEFORE_ECO_MS;
    const wanted = gpsProfileForSpeed(standingLongEnough ? 0 : Math.max(speed, 1));
    if (this.profile && sameProfile(this.profile, wanted)) return null;
    this.profile = wanted;
    return wanted;
  }

  reset(): void {
    this.profile = null;
    this.standingSince = null;
  }
}
