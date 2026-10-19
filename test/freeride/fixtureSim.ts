import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectCurvesXY } from '../../src/curves';
import { FreerideEngine } from '../../src/freeride/engine';
import { evaluateAnnouncements, type AnnouncedCurve } from '../../src/freeride/evaluate';
import { parseOverpass } from '../../src/freeride/overpassClient';
import { RoadGraph } from '../../src/freeride/roadGraph';
import { bearing } from '../../src/geo/angles';
import { cumulativeLengths } from '../../src/geo/polyline';
import type { XY } from '../../src/geo/types';
import { parseGpx } from '../../src/gpx/parseGpx';
import type { Fix } from '../../src/tracking/routeTracker';
import { FreeAnnouncer } from '../../src/voice/freeAnnouncer';

const fx = (n: string) => readFileSync(join(__dirname, '../fixtures', n), 'utf8');

const fixAt = (xy: XY, heading: number | null, speed: number, t: number, toLatLon: (p: XY) => { lat: number; lon: number }): Fix => ({
  ...toLatLon(xy),
  speed,
  accuracy: 5,
  timestamp: t,
  heading,
});

/** Simuliert die Freie Fahrt entlang eines GPX-Tracks mit OSM-Daten und wertet die Ansagen gegen den Track aus. */
export function simulate(track: string, osm: string, coveredRawPoints: number, noiseM = 3) {
  const gpx = parseGpx(fx(track));
  const graph = new RoadGraph(gpx.points[0]!);
  graph.addWays(parseOverpass(JSON.parse(fx(osm))));
  const raw = gpx.points.map((p) => graph.projection.toXY(p));
  const covered = cumulativeLengths(raw)[coveredRawPoints]!;
  const det = detectCurvesXY(raw, graph.projection.origin);
  const engine = new FreerideEngine(graph);
  const ann = new FreeAnnouncer();
  const announced: AnnouncedCurve[] = [];
  let steps = 0;
  let ok = 0;
  for (let d = 40; d < covered - 100; d += 15) {
    const i = Math.round(d / 5);
    const p = det.path[i]!;
    const q = { x: p.x + noiseM * Math.sin(d * 0.37), y: p.y + noiseM * Math.cos(d * 0.51) };
    const heading = bearing(det.path[i - 1]!, det.path[i + 1]!);
    const st = engine.update(fixAt(q, heading, 15, d * 1000, graph.projection.toLatLon));
    steps++;
    if (st.status === 'ok') ok++;
    const a = ann.next(st.upcoming, 15, st.status === 'ok');
    if (a) announced.push(...a.curves);
  }
  const startDistOf = new Map(det.curves.map((c) => [c.startXY, c.startDist]));
  const res = evaluateAnnouncements(announced, det.curves, {
    maxGrade: 4,
    inRegion: (p) => {
      const sd = startDistOf.get(p) ?? 0;
      return sd > 120 && sd < covered - 250;
    },
  });
  return { res, steps, ok };
}
