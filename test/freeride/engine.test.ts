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
import { DEFAULT_ANNOUNCE_SETTINGS } from '../../src/voice/announceScheduler';
import { FreeAnnouncer } from '../../src/voice/freeAnnouncer';
import { TrackBuilder } from '../curves/helpers';
import { simulate } from './fixtureSim';
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

describe('Stabilität der Darstellung', () => {
  it('dieselbe Kurve sieht bei jeder Aktualisierung gleich aus, der Fortschritt wächst', () => {
    const track = new TrackBuilder().straight(300).arc('right', 80, 120).straight(400);
    const graph = roadOf(track);
    const xy = track.xy();
    const engine = new FreerideEngine(graph);
    const sigs = new Set<string>();
    const progress: number[] = [];
    const dists: number[] = [];
    for (let i = 60; i < xy.length - 60; i += 7) {
      const p = xy[i]!;
      const st = engine.update(fixAt(p, bearing(xy[i - 1]!, xy[i + 1]!), 15, i * 1000));
      const u = st.upcoming[0];
      if (!u || u.curve.direction !== 'right') continue;
      sigs.add(`${u.curve.grade}|${u.curve.shape}|${u.curve.minRadius.toFixed(3)}|${u.curve.geometry.length}`);
      progress.push(u.progressM ?? NaN);
      dists.push(u.distanceTo);
    }
    expect(progress.length).toBeGreaterThan(25);
    expect(sigs.size).toBe(1);
    for (let i = 1; i < progress.length; i++) expect(progress[i]!).toBeGreaterThanOrEqual(progress[i - 1]! - 0.5);
    // vor der Kurve sinkt die Entfernung, in der Kurve bleibt sie 0
    for (let i = 1; i < dists.length; i++) expect(dists[i]!).toBeLessThanOrEqual(dists[i - 1]! + 0.5);
    expect(dists[dists.length - 1]).toBe(0);
    expect(progress[0]!).toBeLessThan(0);
    expect(progress[progress.length - 1]!).toBeGreaterThan(40);
  });

  it('auf echter Strecke (Amalfi) ändert keine Kurve ihre Stufe oder Form, solange sie angezeigt wird', () => {
    const gpx = parseGpx(fx('amalfi-coast.gpx'));
    const graph = new RoadGraph(gpx.points[0]!);
    graph.addWays(parseOverpass(JSON.parse(fx('osm-amalfi.json'))));
    const raw = gpx.points.map((p) => graph.projection.toXY(p));
    const covered = cumulativeLengths(raw)[700]!;
    const det = detectCurvesXY(raw, graph.projection.origin);
    const engine = new FreerideEngine(graph);
    const seen = new Map<string, Set<string>>();
    for (let d = 40; d < covered - 100; d += 12) {
      const i = Math.round(d / 5);
      const p = det.path[i]!;
      const heading = bearing(det.path[i - 1]!, det.path[i + 1]!);
      const st = engine.update(fixAt(p, heading, 15, d * 1000, graph.projection.toLatLon));
      const u = st.upcoming[0];
      if (!u) continue;
      const key = `${u.curve.startXY.x.toFixed(1)}_${u.curve.startXY.y.toFixed(1)}`;
      const sig = `${u.curve.grade}|${u.curve.shape}|${u.curve.direction}|${u.curve.geometry.length}`;
      (seen.get(key) ?? seen.set(key, new Set()).get(key)!).add(sig);
    }
    expect(seen.size).toBeGreaterThan(20);
    for (const sigs of seen.values()) expect(sigs.size).toBe(1);
  });
});

describe('FreeAnnouncer: Filter für leichte Kurven', () => {
  const track = new TrackBuilder()
    .straight(300).arc('right', 40, 80).arc('left', 250, 40)
    .straight(300).arc('right', 250, 40)
    .straight(300).arc('left', 40, 80).straight(500);
  const graph = roadOf(track);
  const xy = track.xy();

  function texts(minAnnounceGrade: number) {
    const engine = new FreerideEngine(graph);
    const ann = new FreeAnnouncer({ ...DEFAULT_ANNOUNCE_SETTINGS, minAnnounceGrade });
    const out: string[] = [];
    for (let i = 20; i < xy.length - 20; i += 15) {
      const st = engine.update(fixAt(xy[i]!, bearing(xy[i - 1]!, xy[i + 1]!), 15, i * 1000));
      const a = ann.next(st.upcoming, 15, st.status === 'ok');
      if (a) out.push(a.text);
    }
    return out;
  }

  it('ab Stufe 4: die leichte Einzelkurve entfällt, die Folgekurve steht in der Ansage davor', () => {
    const all = texts(6);
    const filtered = texts(4);
    expect(all).toHaveLength(3);
    expect(filtered).toHaveLength(2);
    expect(filtered[0]).toMatch(/Rechts 3.*danach links 6/);
    expect(filtered[1]).toMatch(/Links 3/);
  });
});
