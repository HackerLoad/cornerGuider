import { detectCurves } from '../../src/curves';
import { DriveSession } from '../../src/drive/driveSession';
import { SimulatedLocationSource } from '../../src/drive/simulator';
import { DEFAULT_DRIVE_SETTINGS } from '../../src/settings';
import { TrackBuilder } from '../curves/helpers';

const det = detectCurves(new TrackBuilder().straight(300).arc('right', 60, 90).straight(300).arc('left', 12, 160).straight(300).latLon());
const route = { path: det.path, projectionOrigin: det.projectionOrigin, curves: det.curves };

const clock = { t: 0 };
const simAt = (speedKmh: number, startDist = 0) =>
  new SimulatedLocationSource(route, { speedKmh, startDist, now: () => clock.t });

function run(sim: SimulatedLocationSource, seconds: number, spoken: string[] = []) {
  clock.t = 0;
  const session = new DriveSession({
    route,
    source: sim,
    speak: (s) => spoken.push(s),
    getSettings: () => DEFAULT_DRIVE_SETTINGS,
    now: () => clock.t,
  });
  return { session, spoken, step: async () => { clock.t += 1000; sim.tick(1000); }, start: () => session.start(), seconds };
}

describe('SimulatedLocationSource', () => {
  it('fährt mit eingestellter Geschwindigkeit und bleibt am Ende stehen', () => {
    const sim = new SimulatedLocationSource(route, { speedKmh: 72 });
    sim.tick(10_000);
    expect(sim.position).toBeCloseTo(200, 3);
    sim.tick(1_000_000);
    expect(sim.position).toBeCloseTo(det.length, 3);
  });

  it('Pause hält an, Speed lässt sich ändern', () => {
    const sim = new SimulatedLocationSource(route, { speedKmh: 36 });
    sim.setPaused(true);
    sim.tick(5000);
    expect(sim.position).toBe(0);
    sim.setPaused(false);
    sim.setSpeedKmh(72);
    sim.tick(1000);
    expect(sim.position).toBeCloseTo(20, 3);
  });

  it('spielt die ganze Route durch die DriveSession ab (Ansagen + Ziel)', async () => {
    const sim = simAt(72);
    const spoken: string[] = [];
    const { step, start } = run(sim, 0, spoken);
    await start();
    for (let i = 0; i < 80; i++) await step();
    expect(spoken.filter((s) => s.startsWith('In '))).toHaveLength(2);
    expect(spoken[spoken.length - 1]).toBe('Ziel erreicht');
    await sim.stop();
  });

  it('seitlicher Versatz löst Off-Route aus', async () => {
    const sim = simAt(36, 50);
    const { session, step, start } = run(sim, 0);
    await start();
    sim.setSideOffset(100);
    for (let i = 0; i < 8; i++) await step();
    expect(session.snapshot.status).toBe('offRoute');
    sim.setSideOffset(0);
    for (let i = 0; i < 3; i++) await step();
    expect(session.snapshot.status).toBe('onRoute');
    await sim.stop();
  });
});
