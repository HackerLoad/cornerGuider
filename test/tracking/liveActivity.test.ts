import { LiveThrottle, toLiveContent } from '../../src/liveActivity/model';
import { liveInputFromDrive, liveInputFromFreeride } from '../../src/liveActivity/mappers';
import type { DriveSnapshot } from '../../src/drive/driveSession';
import type { FreerideSnapshot } from '../../src/freeride/session';
import type { UpcomingCurve } from '../../src/tracking/nextCurves';

const up = (over: Partial<UpcomingCurve> = {}, curve: Partial<UpcomingCurve['curve']> = {}): UpcomingCurve => ({
  curve: { direction: 'right', grade: 3, ...curve } as UpcomingCurve['curve'],
  distanceTo: 237,
  inside: false,
  ...over,
});

describe('toLiveContent', () => {
  it('Kurve: Titel, Entfernung, Bild und Fortschritt', () => {
    const c = toLiveContent({ kind: 'curve', direction: 'right', grade: 3, distanceM: 237 });
    expect(c.title).toBe('Rechts 3');
    expect(c.subtitle).toBe('In 240 m');
    expect(c.imageName).toBe('curve_right_3');
    expect(c.progress).toBeCloseTo(0.55, 5); // 1 - 237/500, auf 0,05 gerundet
  });

  it('Spitzkehre, in der Kurve und imperiale Einheiten', () => {
    expect(toLiveContent({ kind: 'curve', direction: 'left', grade: 1, distanceM: 90 }).title).toBe('Spitzkehre links');
    const inside = toLiveContent({ kind: 'curve', direction: 'left', grade: 2, distanceM: 0, inside: true });
    expect(inside.subtitle).toBe('Jetzt in der Kurve');
    expect(inside.progress).toBe(1);
    expect(toLiveContent({ kind: 'curve', direction: 'right', grade: 4, distanceM: 80 }, 'imperial').subtitle).toBe('In 260 ft');
  });

  it('Sonderzustände', () => {
    expect(toLiveContent({ kind: 'offRoute' }).title).toBe('Abseits der Route');
    expect(toLiveContent({ kind: 'searching' }).imageName).toBe('gps');
    expect(toLiveContent({ kind: 'finished' }).imageName).toBe('finish');
    expect(toLiveContent({ kind: 'noData' }).title).toBe('Keine Straßendaten');
    expect(toLiveContent({ kind: 'uncertain' }).subtitle).toBe('Keine Ansagen');
  });

  it('der Schlüssel ändert sich nur, wenn sich die Anzeige ändert', () => {
    const a = toLiveContent({ kind: 'curve', direction: 'right', grade: 3, distanceM: 243 }).key;
    const b = toLiveContent({ kind: 'curve', direction: 'right', grade: 3, distanceM: 238 }).key;
    const c = toLiveContent({ kind: 'curve', direction: 'right', grade: 3, distanceM: 200 }).key;
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('LiveThrottle', () => {
  it('sendet nur bei Änderung und höchstens alle 2 s', () => {
    const t = new LiveThrottle(2000);
    expect(t.shouldSend('a', 0)).toBe(true);
    expect(t.shouldSend('a', 5000)).toBe(false); // unverändert
    expect(t.shouldSend('b', 1000)).toBe(false); // zu früh
    expect(t.shouldSend('b', 2500)).toBe(true);
    t.reset();
    expect(t.shouldSend('b', 2600)).toBe(true);
  });
});

describe('Zuordnung der Fahrzustände', () => {
  const drive = (status: DriveSnapshot['status'], upcoming: UpcomingCurve[] = []): DriveSnapshot => ({
    status, dist: 0, remaining: 0, speed: 0, offset: 0, upcoming,
  });
  const free = (over: Partial<FreerideSnapshot>): FreerideSnapshot => ({
    status: 'ok', riderXY: { x: 0, y: 0 }, heading: 0, aheadM: 0, riderDist: 0, upcoming: [], data: 'ready', speed: 0, ...over,
  });

  it('geplante Route', () => {
    expect(liveInputFromDrive(null).kind).toBe('searching');
    expect(liveInputFromDrive(drive('offRoute')).kind).toBe('offRoute');
    expect(liveInputFromDrive(drive('finished')).kind).toBe('finished');
    const i = liveInputFromDrive(drive('onRoute', [up()]));
    expect(i).toMatchObject({ kind: 'curve', direction: 'right', grade: 3, distanceM: 237 });
  });

  it('Freie Fahrt', () => {
    expect(liveInputFromFreeride(null).kind).toBe('searching');
    expect(liveInputFromFreeride(free({ status: 'noRoad', data: 'error' })).kind).toBe('noData');
    expect(liveInputFromFreeride(free({ status: 'noRoad', data: 'loading' })).kind).toBe('searching');
    expect(liveInputFromFreeride(free({ status: 'uncertain' })).kind).toBe('uncertain');
    expect(liveInputFromFreeride(free({ upcoming: [up({ inside: true, distanceTo: 0 })] }))).toMatchObject({ kind: 'curve', inside: true });
  });
});
