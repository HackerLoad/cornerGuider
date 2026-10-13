import { detectCurves } from '../../src/curves';
import { makeProjection } from '../../src/geo/projection';
import { gpsProfileForSpeed } from '../../src/tracking/adaptiveGps';
import { nextCurves } from '../../src/tracking/nextCurves';
import { RouteTracker, type Fix } from '../../src/tracking/routeTracker';
import { TrackBuilder } from '../curves/helpers';

const track = new TrackBuilder().straight(300).arc('right', 60, 90).straight(300).arc('left', 40, 90).straight(300);
const det = detectCurves(track.latLon());
const route = { path: det.path, projectionOrigin: det.projectionOrigin, curves: det.curves };
const proj = makeProjection(det.projectionOrigin);

/** Fix an Routendistanz d (m), seitlich um `side` m versetzt. */
function fixAt(d: number, t: number, opts: { side?: number; speed?: number } = {}): Fix {
  const i = Math.min(route.path.length - 2, Math.floor(d / 5));
  const a = route.path[i]!;
  const b = route.path[i + 1]!;
  const f = (d - i * 5) / 5;
  const x = a.x + (b.x - a.x) * f;
  const y = a.y + (b.y - a.y) * f;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const nx = -(b.y - a.y) / len;
  const ny = (b.x - a.x) / len;
  const side = opts.side ?? 0;
  const ll = proj.toLatLon({ x: x + nx * side, y: y + ny * side });
  return { ...ll, speed: opts.speed ?? 15, accuracy: 5, timestamp: t };
}

describe('RouteTracker', () => {
  it('snappt auf die Route und liefert Distanz entlang der Route', () => {
    const tr = new RouteTracker(route);
    const s = tr.update(fixAt(100, 1000, { side: 8 }), 1000);
    expect(s.status).toBe('onRoute');
    expect(Math.abs(s.dist - 100)).toBeLessThan(2);
    expect(s.offset).toBeCloseTo(8, 0);
  });

  it('läuft nie rückwärts (GPS-Jitter)', () => {
    const tr = new RouteTracker(route);
    tr.update(fixAt(200, 1000), 1000);
    const s = tr.update(fixAt(195, 2000), 2000);
    expect(s.dist).toBeGreaterThanOrEqual(199);
  });

  it('gleicht Latenz mit Geschwindigkeit aus', () => {
    const tr = new RouteTracker(route);
    const s = tr.update(fixAt(100, 1000, { speed: 20 }), 1500); // 0,5 s alt
    expect(Math.abs(s.dist - 110)).toBeLessThan(2);
  });

  it('deckelt die Latenzkompensation', () => {
    const tr = new RouteTracker(route);
    const s = tr.update(fixAt(100, 0, { speed: 20 }), 60_000);
    expect(Math.abs(s.dist - 160)).toBeLessThan(2); // max. 3 s × 20 m/s
  });

  it('meldet Off-Route erst nach > 5 s und erholt sich wieder', () => {
    const tr = new RouteTracker(route);
    tr.update(fixAt(100, 0), 0);
    expect(tr.update(fixAt(120, 1000, { side: 80 }), 1000).status).toBe('onRoute');
    expect(tr.update(fixAt(140, 4000, { side: 80 }), 4000).status).toBe('onRoute');
    expect(tr.update(fixAt(160, 6500, { side: 80 }), 6500).status).toBe('offRoute');
    const back = tr.update(fixAt(220, 9000), 9000);
    expect(back.status).toBe('onRoute');
    expect(Math.abs(back.dist - 220)).toBeLessThan(3);
  });

  it('kurze Ausreißer lösen kein Off-Route aus', () => {
    const tr = new RouteTracker(route);
    tr.update(fixAt(100, 0), 0);
    tr.update(fixAt(115, 1000, { side: 80 }), 1000);
    expect(tr.update(fixAt(130, 2000), 2000).status).toBe('onRoute');
    expect(tr.update(fixAt(145, 3000, { side: 80 }), 3000).status).toBe('onRoute');
    expect(tr.update(fixAt(160, 7500, { side: 80 }), 7500).status).toBe('onRoute'); // Timer läuft erst seit 3000
  });

  it('ignoriert ungenaue Fixes', () => {
    const tr = new RouteTracker(route);
    tr.update(fixAt(100, 0), 0);
    const s = tr.update({ ...fixAt(400, 1000), accuracy: 500 }, 1000);
    expect(Math.abs(s.dist - 100)).toBeLessThan(3);
  });

  it('erkennt das Ende der Route', () => {
    const tr = new RouteTracker(route);
    tr.update(fixAt(det.length - 5, 0), 0);
    expect(tr.current.status).toBe('finished');
  });
});

describe('nextCurves', () => {
  it('liefert die kommenden Kurven mit Distanz entlang der Route', () => {
    const list = nextCurves(route.curves, 100, 5);
    expect(list).toHaveLength(2);
    expect(list[0]!.curve.direction).toBe('right');
    expect(Math.abs(list[0]!.distanceTo - 200)).toBeLessThan(15);
    expect(list[0]!.inside).toBe(false);
  });

  it('markiert die aktuelle Kurve als inside und lässt passierte weg', () => {
    const c0 = route.curves[0]!;
    const inside = nextCurves(route.curves, c0.startDist + 10, 5);
    expect(inside[0]!.inside).toBe(true);
    expect(inside[0]!.distanceTo).toBe(0);
    expect(nextCurves(route.curves, c0.endDist + 1, 5)[0]!.curve.index).toBe(1);
  });
});

describe('gpsProfileForSpeed', () => {
  it('spart im Stand, ortet in Bewegung genau', () => {
    expect(gpsProfileForSpeed(0).accuracy).toBe('balanced');
    expect(gpsProfileForSpeed(null).accuracy).toBe('balanced');
    expect(gpsProfileForSpeed(12)).toMatchObject({ accuracy: 'best', timeIntervalMs: 1000 });
  });
});
