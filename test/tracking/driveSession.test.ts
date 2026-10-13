import { DriveSession } from '../../src/drive/driveSession';
import type { LocationSource } from '../../src/drive/locationSource';
import { detectCurves } from '../../src/curves';
import { makeProjection } from '../../src/geo/projection';
import { DEFAULT_DRIVE_SETTINGS } from '../../src/settings';
import type { Fix } from '../../src/tracking/routeTracker';
import { TrackBuilder } from '../curves/helpers';

const det = detectCurves(
  new TrackBuilder().straight(300).arc('right', 60, 90).straight(300).arc('left', 12, 160).straight(300).latLon(),
);
const route = { path: det.path, projectionOrigin: det.projectionOrigin, curves: det.curves };
const proj = makeProjection(det.projectionOrigin);

function setup() {
  const spoken: string[] = [];
  let listener: ((f: Fix) => void) | null = null;
  const source: LocationSource = {
    start: async (l) => {
      listener = l;
    },
    stop: async () => undefined,
  };
  let t = 0;
  const session = new DriveSession({ route, source, speak: (s) => spoken.push(s), getSettings: () => DEFAULT_DRIVE_SETTINGS, now: () => t });
  const drive = (d: number, opts: { side?: number; speed?: number } = {}) => {
    const i = Math.min(route.path.length - 2, Math.floor(d / 5));
    const a = route.path[i]!;
    const b = route.path[i + 1]!;
    const f = (d - i * 5) / 5;
    const side = opts.side ?? 0;
    const ll = proj.toLatLon({ x: a.x + (b.x - a.x) * f + side, y: a.y + (b.y - a.y) * f });
    t += 1000;
    listener!({ ...ll, speed: opts.speed ?? 15, accuracy: 5, timestamp: t });
  };
  return { session, spoken, drive };
}

describe('DriveSession', () => {
  it('sagt Kurven während der Fahrt an, jede einmal', async () => {
    const { session, spoken, drive } = setup();
    await session.start();
    for (let d = 0; d < det.length; d += 15) drive(d);
    expect(spoken.filter((s) => s.startsWith('In '))).toHaveLength(2);
    expect(spoken[0]).toMatch(/Rechts/);
    expect(spoken.some((s) => s.includes('Spitzkehre links'))).toBe(true);
    expect(spoken[spoken.length - 1]).toBe('Ziel erreicht');
  });

  it('zeigt die nächsten Kurven im Snapshot', async () => {
    const { session, drive } = setup();
    await session.start();
    drive(100);
    expect(session.snapshot.status).toBe('onRoute');
    expect(session.snapshot.upcoming.length).toBe(2);
    expect(session.snapshot.upcoming[0]!.distanceTo).toBeGreaterThan(150);
  });

  it('meldet Off-Route und schweigt dabei über Kurven', async () => {
    const { session, spoken, drive } = setup();
    await session.start();
    drive(100);
    for (let i = 0; i < 8; i++) drive(110 + i * 15, { side: 120 });
    expect(session.snapshot.status).toBe('offRoute');
    expect(session.snapshot.upcoming).toHaveLength(0);
    expect(spoken).toContain('Abseits der Route');
    drive(260);
    expect(spoken).toContain('Wieder auf der Route');
  });

  it('spricht nichts bei ausgeschalteter Sprache', async () => {
    const spoken: string[] = [];
    let l: ((f: Fix) => void) | null = null;
    const s = new DriveSession({
      route,
      source: { start: async (x) => void (l = x), stop: async () => undefined },
      speak: (x) => spoken.push(x),
      getSettings: () => ({ ...DEFAULT_DRIVE_SETTINGS, voiceEnabled: false }),
    });
    await s.start();
    const p = proj.toLatLon(route.path[50]!);
    l!({ ...p, speed: 15, accuracy: 5, timestamp: 1 });
    expect(spoken).toHaveLength(0);
  });
});
