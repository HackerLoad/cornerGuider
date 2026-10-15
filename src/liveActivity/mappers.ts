import type { DriveSnapshot } from '../drive/driveSession';
import type { FreerideSnapshot } from '../freeride/session';
import type { UpcomingCurve } from '../tracking/nextCurves';
import type { LiveInput } from './model';

const curveInput = (u: UpcomingCurve): LiveInput => ({
  kind: 'curve',
  direction: u.curve.direction,
  grade: u.curve.grade,
  distanceM: u.distanceTo,
  inside: u.inside,
});

/** Geplante Route → Live-Aktivität. */
export function liveInputFromDrive(s: DriveSnapshot | null): LiveInput {
  if (!s || s.status === 'acquiring') return { kind: 'searching' };
  if (s.status === 'offRoute') return { kind: 'offRoute' };
  if (s.status === 'finished') return { kind: 'finished' };
  const first = s.upcoming[0];
  return first ? curveInput(first) : { kind: 'finished' };
}

/** Freie Fahrt → Live-Aktivität. */
export function liveInputFromFreeride(s: FreerideSnapshot | null): LiveInput {
  if (!s) return { kind: 'searching' };
  if (s.status === 'noRoad') return s.data === 'error' ? { kind: 'noData' } : { kind: 'searching' };
  if (s.status === 'uncertain') return { kind: 'uncertain' };
  const first = s.upcoming[0];
  return first ? curveInput(first) : { kind: 'searching' };
}
