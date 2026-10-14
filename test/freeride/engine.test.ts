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
import { TrackBuilder } from '../curves/helpers';
import { graphOf, proj, way } from './net';

const fixAt = (xy: XY, heading: number | null, speed = 15, t = 0, toLatLon = proj.toLatLon): Fix => ({
  ...toLatLon(xy),
  speed,
  accuracy: 5,
  timestamp: t,
  heading,
});

function roadOf(track: TrackBuilder) {
  const pts = track.xy();
  return graphOf([way(1, pts.map((_, i) => i + 1), pts.map((p) => [p.x, p.y] as [number, number]))]);
}

describe('FreerideEngine', () => {
  const track = new TrackBuilder().straight(400).arc('right', 60, 90).straight(600);
  const graph = roadOf(track);

  it('sagt die Kurve voraus: Richtung und Entfernung entlang der Straße', () => {
    const engine = new FreerideEngine(graph);
    const s = engine.update(fixAt({ x: 0, y: 100 }, 0));
    expect(s.status).toBe('ok');
    expect(s.upcoming.length).toBeGreaterThan(0);
    const u = s.upcoming[0]!;
    expect(u.curve.direction).toBe('right');
    expect(Math.abs(u.distanceTo - 300)).toBeLessThan(15);
    expect(s.endReason).toBe('horizon');
  });

  it('meldet noRoad ohne Straße in der Nähe', () => {
    const engine = new FreerideEngine(graph);
    expect(engine.update(fixAt({ x: 500, y: 100 }, 0)).status).toBe('noRoad');
  });

  it('leitet die Richtung aus der Bewegung ab, wenn das GPS keine liefert', () => {
    const engine = new FreerideEngine(graph);
    engine.update(fixAt({ x: 0, y: 50 }, null, 15, 0));
    const s = engine.update(fixAt({ x: 0, y: 65 }, null, 15, 1000));
    expect(s.heading).not.toBeNull();
    expect(s.upcoming[0]!.curve.direction).toBe('right');
  });

  it('meldet keine Kurve, die am Pfadende abgeschnitten wäre', () => {
    // Straße endet mitten in der Kurve
    const cut = roadOf(new TrackBuilder().straight(200).arc('right', 60, 40));
    const s = new FreerideEngine(cut).update(fixAt({ x: 0, y: 100 }, 0));
    expect(s.endReason).toBe('dataEnd');
    expect(s.upcoming).toHaveLength(0);
  });
});

describe('FreeAnnouncer mit Engine', () => {
  const graph = roadOf(new TrackBuilder().straight(400).arc('right', 60, 90).straight(500));

  function drive(confident = true) {
    const engine = new FreerideEngine(graph);
    const ann = new FreeAnnouncer();
    const texts: string[] = [];
    for (let y = 20; y < 600; y += 15) {
      const st = engine.update(fixAt({ x: 0, y }, 0, 15, y * 100));
      const a = ann.next(st.upcoming, 15, confident && st.status === 'ok');
      if (a) texts.push(a.text);
    }
    return texts;
  }

  it('sagt die Kurve genau einmal an, mit Vorlauf', () => {
    const texts = drive();
    expect(texts).toHaveLength(1);
    expect(texts[0]).toMatch(/^In \d+ Metern Rechts/);
  });

  it('schweigt, wenn die Straße nicht sicher zugeordnet ist', () => {
    expect(drive(false)).toHaveLength(0);
  });
});

describe('evaluateAnnouncements', () => {
  const det = detectCurvesXY(new TrackBuilder().straight(200).arc('left', 60, 80).straight(300).arc('right', 40, 90).straight(200).xy(), { lat: 47, lon: 11 });
  const real = det.curves;
  const a = (i: number, over: Partial<AnnouncedCurve> = {}): AnnouncedCurve => ({
    start: real[i]!.startXY,
    grade: real[i]!.grade,
    direction: real[i]!.direction,
    ...over,
  });

  it('zählt richtige Ansagen, Falschmeldungen und verpasste Kurven', () => {
    expect(real).toHaveLength(2);
    const perfect = evaluateAnnouncements([a(0), a(1)], real);
    expect(perfect.precision).toBe(1);
    expect(perfect.recall).toBe(1);

    const wrongDir = evaluateAnnouncements([a(0, { direction: 'right' }), a(1)], real);
    expect(wrongDir.falseAlarms).toHaveLength(1);
    expect(wrongDir.missed).toHaveLength(1);

    const far = evaluateAnnouncements([a(0, { start: { x: real[0]!.startXY.x + 200, y: real[0]!.startXY.y } })], real);
    expect(far.precision).toBe(0);
    expect(far.recall).toBe(0);

    const tolerance = evaluateAnnouncements([a(0, { grade: real[0]!.grade + 1 })], real);
    expect(tolerance.correct).toBe(1);
  });
});

// Regressionsschutz mit echten Daten: GPX-Track als Wahrheit, OSM-Daten (Overpass-Abzug) als Vorhersage.
const fx = (n: string) => readFileSync(join(__dirname, '../fixtures', n), 'utf8');

function simulate(track: string, osm: string, coveredRawPoints: number, noiseM = 3) {
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

describe('Freie Fahrt auf echten Strecken (Regressionsschutz, kein Gütesiegel)', () => {
  // Gemessen: Amalfi Trefferquote 0,93 / Genauigkeit 0,99; Stelvio 0,71 / 0,89 (Track läuft dort teils über Nebenstraßen).
  it('Amalfi: fast alle Kurven bis Stufe 4 werden richtig angesagt', () => {
    const { res, ok, steps } = simulate('amalfi-coast.gpx', 'osm-amalfi.json', 700);
    expect(res.precision).toBeGreaterThanOrEqual(0.95);
    expect(res.recall).toBeGreaterThanOrEqual(0.85);
    expect(ok / steps).toBeGreaterThan(0.9);
  });

  it('Stelvio: weniger Treffer, aber ohne viele Falschmeldungen', () => {
    const { res } = simulate('stelvio.gpx', 'osm-stelvio.json', 450);
    expect(res.precision).toBeGreaterThanOrEqual(0.8);
    expect(res.recall).toBeGreaterThanOrEqual(0.6);
  });
});
