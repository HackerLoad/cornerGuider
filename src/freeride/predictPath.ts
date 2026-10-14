import { angleDiff, bearing } from '../geo/angles';
import { dist } from '../geo/polyline';
import type { XY } from '../geo/types';
import type { Match } from './mapMatch';
import type { GraphWay, RoadGraph } from './roadGraph';

export type EndReason = 'horizon' | 'junction' | 'roundabout' | 'dataEnd';

export interface PathConfig {
  /** So weit wird nach vorn vorhergesagt (m) */
  horizonM: number;
  /** So weit wird der Weg hinter der Position mitgenommen, damit eine begonnene Kurve komplett ist (m) */
  backM: number;
  /** Zwei Weiterfahrten, die weniger als so viele Grad auseinanderliegen, gelten als nicht unterscheidbar */
  ambiguityDeg: number;
  /** Weiterfahrten mit größerer Richtungsänderung gelten nie als ernsthafte Alternative */
  maxAmbiguousTurnDeg: number;
  /** Länge, über die die Richtung an Kreuzungen bestimmt wird (m) */
  bearingSampleM: number;
}

export const DEFAULT_PATH_CONFIG: PathConfig = {
  horizonM: 600,
  backM: 80,
  ambiguityDeg: 30,
  maxAmbiguousTurnDeg: 75,
  bearingSampleM: 15,
};

export interface PredictedPath {
  /** Hinten ~backM, Position, vorn bis Horizont bzw. Kreuzung */
  pts: XY[];
  /** Entfernung der aktuellen Position vom Anfang von `pts` (m) */
  positionDist: number;
  /** Länge ab der Position bis zum Ende der Vorhersage (m) */
  ahead: number;
  endReason: EndReason;
  wayName?: string;
  wayRef?: string;
}

interface Walk {
  pts: XY[];
  reason: EndReason;
}

/** Punkt in Entfernung `d` entlang der Straße ab Knoten `idx` in Richtung `dir`. */
function pointAlong(way: GraphWay, idx: number, dir: 1 | -1, d: number): XY {
  let acc = 0;
  let prev = way.pts[idx]!;
  for (let i = idx + dir; i >= 0 && i < way.pts.length; i += dir) {
    const next = way.pts[i]!;
    const seg = dist(prev, next);
    if (acc + seg >= d) {
      const f = seg === 0 ? 0 : (d - acc) / seg;
      return { x: prev.x + (next.x - prev.x) * f, y: prev.y + (next.y - prev.y) * f };
    }
    acc += seg;
    prev = next;
  }
  return prev;
}

/** Fahrtrichtung am Ende der bisherigen Punktfolge (über ~sampleM). */
function tailBearing(pts: XY[], sampleM: number): number | null {
  const end = pts[pts.length - 1]!;
  let acc = 0;
  for (let i = pts.length - 2; i >= 0; i--) {
    acc += dist(pts[i]!, pts[i + 1]!);
    if (acc >= sampleM || i === 0) return acc > 1e-6 ? bearing(pts[i]!, end) : null;
  }
  return null;
}

interface Option {
  way: GraphWay;
  idx: number;
  dir: 1 | -1;
  turn: number;
  adjusted: number;
}

/** Bei gleicher Straßennummer/gleichem Namen zählt die Weiterfahrt wie eine um so viele Grad geradere. */
const SAME_ROAD_BONUS_DEG = 35;

const sameRoad = (a: GraphWay, b: GraphWay) =>
  (!!a.ref && a.ref === b.ref) || (!!a.name && a.name === b.name);

/** Läuft ab `startPoint` entlang der Straße bis `maxLen` m, einer Kreuzung ohne eindeutige Weiterfahrt oder dem Datenende. */
function walk(
  graph: RoadGraph,
  startWay: GraphWay,
  startPoint: XY,
  startSeg: number,
  startDir: 1 | -1,
  maxLen: number,
  cfg: PathConfig,
): Walk {
  let way = startWay;
  let dir = startDir;
  let v = dir === 1 ? startSeg + 1 : startSeg;
  const all: XY[] = [startPoint];
  const out: XY[] = [];
  let len = 0;

  for (let guard = 0; guard < 5000; guard++) {
    const target = way.pts[v]!;
    const last = all[all.length - 1]!;
    const step = dist(last, target);
    if (len + step >= maxLen) {
      const f = step === 0 ? 0 : (maxLen - len) / step;
      out.push({ x: last.x + (target.x - last.x) * f, y: last.y + (target.y - last.y) * f });
      return { pts: out, reason: 'horizon' };
    }
    if (step > 1e-6) {
      all.push(target);
      out.push(target);
      len += step;
    }

    const atEnd = dir === 1 ? v === way.pts.length - 1 : v === 0;
    const node = way.nodes[v]!;
    const refs = graph.nodeRefs.get(node) ?? [];
    const isJunction = refs.length > 1;

    if (!atEnd && !isJunction) {
      v += dir;
      continue;
    }
    if (atEnd && !isJunction) return { pts: out, reason: 'dataEnd' };

    // Kreuzung oder Wechsel auf die nächste Straße
    const incoming = tailBearing(all, cfg.bearingSampleM);
    const nodePt = way.pts[v]!;
    const options: Option[] = [];
    for (const ref of refs) {
      const w2 = graph.ways.get(ref.wayId);
      if (!w2) continue;
      const dirs: (1 | -1)[] = [];
      if (w2.id === way.id) {
        if (ref.index !== v || atEnd) continue;
        dirs.push(dir);
      } else {
        if (ref.index < w2.pts.length - 1) dirs.push(1);
        if (ref.index > 0) dirs.push(-1);
      }
      for (const d of dirs) {
        if ((d === 1 && w2.oneway === 'backward') || (d === -1 && w2.oneway === 'forward')) continue;
        const outB = bearing(nodePt, pointAlong(w2, ref.index, d, cfg.bearingSampleM));
        const turn = incoming === null ? 0 : angleDiff(incoming, outB);
        if (turn > 150) continue; // Umkehr
        options.push({ way: w2, idx: ref.index, dir: d, turn, adjusted: turn - (sameRoad(way, w2) ? SAME_ROAD_BONUS_DEG : 0) });
      }
    }
    if (options.length === 0) return { pts: out, reason: 'dataEnd' };
    if (way.roundabout || options.some((o) => o.way.roundabout)) return { pts: out, reason: 'roundabout' };

    options.sort((a, b) => a.adjusted - b.adjusted);
    const best = options[0]!;
    const second = options[1];
    if (second && second.adjusted < cfg.maxAmbiguousTurnDeg && second.adjusted - best.adjusted < cfg.ambiguityDeg) {
      return { pts: out, reason: 'junction' };
    }
    way = best.way;
    dir = best.dir;
    v = best.idx + dir;
  }
  return { pts: out, reason: 'dataEnd' };
}

/** Sagt den Straßenverlauf vor (und ein Stück zurück) ab der zugeordneten Position voraus. */
export function predictPath(graph: RoadGraph, match: Match, cfg: PathConfig = DEFAULT_PATH_CONFIG): PredictedPath {
  const way = graph.ways.get(match.wayId);
  if (!way) throw new Error('predictPath: unbekannte Straße');
  const dir: 1 | -1 = match.forward ? 1 : -1;
  const fwd = walk(graph, way, match.point, match.seg, dir, cfg.horizonM, cfg);
  const back = walk(graph, way, match.point, match.seg, (-dir) as 1 | -1, cfg.backM, cfg);

  const behind = back.pts.slice().reverse();
  const pts = [...behind, match.point, ...fwd.pts];
  let positionDist = 0;
  for (let i = 1; i <= behind.length; i++) positionDist += dist(pts[i - 1]!, pts[i]!);
  let ahead = 0;
  for (let i = behind.length + 1; i < pts.length; i++) ahead += dist(pts[i - 1]!, pts[i]!);
  return { pts, positionDist, ahead, endReason: fwd.reason, wayName: way.name, wayRef: way.ref };
}
