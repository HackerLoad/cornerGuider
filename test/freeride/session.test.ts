import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectCurves } from '../../src/curves';
import { SimulatedLocationSource } from '../../src/drive/simulator';
import { evaluateRecording } from '../../src/freeride/evaluateRecording';
import { parseOverpass } from '../../src/freeride/overpassClient';
import { FreerideSession } from '../../src/freeride/session';
import { parseGpx } from '../../src/gpx/parseGpx';
import { DEFAULT_DRIVE_SETTINGS } from '../../src/settings';

const fx = (n: string) => readFileSync(join(__dirname, '../fixtures', n), 'utf8');
const det = detectCurves(parseGpx(fx('amalfi-coast.gpx')).points);
const route = { path: det.path, projectionOrigin: det.projectionOrigin };
const ways = parseOverpass(JSON.parse(fx('osm-amalfi.json')));
const flush = () => new Promise<void>((r) => setImmediate(r));

function setup(fetchRoads: (c: unknown, r: number) => Promise<typeof ways>, speedKmh = 54) {
  const clock = { t: 1_000_000 };
  const sim = new SimulatedLocationSource(route, { speedKmh, startDist: 60, now: () => clock.t });
  const spoken: string[] = [];
  const session = new FreerideSession({
    source: sim,
    speak: (t) => spoken.push(t),
    getSettings: () => DEFAULT_DRIVE_SETTINGS,
    fetchRoads: fetchRoads as never,
    now: () => clock.t,
    retryMs: 10_000,
  });
  const step = async () => {
    clock.t += 1000;
    sim.tick(1000);
    await flush();
  };
  return { sim, session, spoken, step, clock };
}

describe('FreerideSession', () => {
  it('lädt Straßendaten, sagt Kurven an und zeichnet die Fahrt auf', async () => {
    const fetchRoads = jest.fn(async () => ways);
    const { session, spoken, step, sim } = setup(fetchRoads);
    await session.start();
    expect(session.snapshot.data).toBe('loading');
    await flush();
    for (let i = 0; i < 280; i++) await step();
    await sim.stop();

    expect(fetchRoads).toHaveBeenCalled();
    expect(session.snapshot.data).toBe('ready');
    expect(spoken.length).toBeGreaterThan(10);
    expect(spoken[0]).toMatch(/^In \d+ Metern/);

    const rec = session.getRecording()!;
    expect(rec.fixes.length).toBeGreaterThan(250);
    expect(rec.announcements.length).toBe(spoken.length);
    expect(rec.stats.steps).toBe(rec.fixes.length);
    expect(rec.stats.ok / rec.stats.steps).toBeGreaterThan(0.8);

    // Selbstauswertung gegen die tatsächlich gefahrene Spur
    const sum = evaluateRecording(rec)!;
    expect(sum.distanceKm).toBeGreaterThan(3);
    expect(sum.eval.precision).toBeGreaterThanOrEqual(0.75); // Wahrheit aus nur alle 15 m aufgezeichneten Positionen
    expect(sum.eval.recall).toBeGreaterThanOrEqual(0.6);
  });

  it('schweigt bei ausgeschalteter Sprache, zeichnet aber weiter auf', async () => {
    const { session, step, sim } = setup(async () => ways);
    (session as unknown as { o: { getSettings: () => unknown } }).o.getSettings = () => ({ ...DEFAULT_DRIVE_SETTINGS, voiceEnabled: false });
    const spoken: string[] = [];
    (session as unknown as { o: { speak: (t: string) => void } }).o.speak = (t) => spoken.push(t);
    await session.start();
    await flush();
    for (let i = 0; i < 120; i++) await step();
    await sim.stop();
    expect(spoken).toHaveLength(0);
    expect(session.getRecording()!.announcements.length).toBeGreaterThan(0);
  });

  it('meldet Datenfehler und versucht es nach der Wartezeit erneut', async () => {
    let calls = 0;
    const fetchRoads = jest.fn(async () => {
      calls++;
      if (calls <= 2) throw new Error('504');
      return ways;
    });
    const { session, step, sim } = setup(fetchRoads);
    await session.start();
    await flush();
    await step();
    expect(session.snapshot.data).toBe('error');
    expect(session.snapshot.dataError).toContain('504');
    const first = fetchRoads.mock.calls.length;
    for (let i = 0; i < 5; i++) await step(); // noch innerhalb der Wartezeit (10 s)
    expect(fetchRoads.mock.calls.length).toBe(first);
    for (let i = 0; i < 40; i++) await step();
    await sim.stop();
    expect(fetchRoads.mock.calls.length).toBeGreaterThan(first);
    expect(session.snapshot.data).toBe('ready');
  });

  it('lädt nach, sobald die Straße voraus nicht mehr abgedeckt ist', async () => {
    const fetchRoads = jest.fn(async () => ways);
    const { session, step, sim } = setup(fetchRoads, 108);
    await session.start();
    await flush();
    for (let i = 0; i < 150; i++) await step();
    await sim.stop();
    expect(fetchRoads.mock.calls.length).toBeGreaterThan(1);
  });
});
