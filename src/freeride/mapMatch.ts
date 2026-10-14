import { angleDiff, bearing } from '../geo/angles';
import type { XY } from '../geo/types';
import type { GraphWay, RoadGraph } from './roadGraph';

export interface Match {
  wayId: number;
  /** Segmentindex (zwischen pts[seg] und pts[seg+1]) */
  seg: number;
  /** Anteil 0…1 auf dem Segment */
  t: number;
  /** Bogenlänge vom Wegbeginn (m) */
  s: number;
  /** seitlicher Abstand zur Straße (m) */
  lateral: number;
  /** true = Fahrt in Richtung aufsteigender Knotenindizes */
  forward: boolean;
  /** Abweichung zwischen Fahrtrichtung und Straßenrichtung in Grad (null = Richtung unbekannt) */
  headingDiff: number | null;
  /** false, wenn eine andere Straße fast gleich gut passt (z. B. parallele Straßen) */
  confident: boolean;
  point: XY;
}

export interface MatchConfig {
  /** Suchradius (m) */
  radiusM: number;
  /** Größte erlaubte Richtungsabweichung (Grad), wenn die Fahrtrichtung bekannt ist */
  maxHeadingDiff: number;
  /** Gewicht der Richtungsabweichung in Metern pro Grad */
  headingWeight: number;
  /** Bonus für die zuvor zugeordnete Straße (Hysterese, m) */
  stickyBonusM: number;
  /** Mindestabstand der Scores, damit die Zuordnung als sicher gilt */
  confidentMargin: number;
}

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  radiusM: 35,
  maxHeadingDiff: 70,
  headingWeight: 0.35,
  stickyBonusM: 6,
  confidentMargin: 4,
};

const CLASS_PENALTY: Record<string, number> = { service: 6, living_street: 4, residential: 2 };

interface Candidate {
  match: Match;
  score: number;
}

function candidatesOn(
  way: GraphWay,
  p: XY,
  heading: number | null,
  prev: Match | null,
  cfg: MatchConfig,
): Candidate | null {
  let best: Candidate | null = null;
  for (let i = 0; i < way.pts.length - 1; i++) {
    const a = way.pts[i]!;
    const b = way.pts[i + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) continue;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    const lateral = Math.hypot(p.x - px, p.y - py);
    if (lateral > cfg.radiusM) continue;

    const segBearing = bearing(a, b);
    let forward: boolean;
    let diff: number | null = null;
    let penalty = 0;
    if (heading !== null) {
      const df = angleDiff(heading, segBearing);
      const db = angleDiff(heading, (segBearing + 180) % 360);
      forward = df <= db;
      diff = Math.min(df, db);
      // Einbahnstraße: Fahrt gegen die Richtung stark bestrafen
      if ((way.oneway === 'forward' && !forward) || (way.oneway === 'backward' && forward)) penalty += 40;
      if (diff > cfg.maxHeadingDiff) continue;
    } else if (way.oneway !== 'no') {
      forward = way.oneway === 'forward';
    } else {
      forward = prev && prev.wayId === way.id ? prev.forward : true;
    }

    penalty += CLASS_PENALTY[way.highway] ?? 0;
    let score = lateral + (diff ?? 0) * cfg.headingWeight + penalty;
    if (prev && prev.wayId === way.id) score -= cfg.stickyBonusM;
    if (!best || score < best.score) {
      best = {
        score,
        match: {
          wayId: way.id,
          seg: i,
          t,
          s: way.cum[i]! + t * Math.sqrt(len2),
          lateral,
          forward,
          headingDiff: diff,
          confident: true,
          point: { x: px, y: py },
        },
      };
    }
  }
  return best;
}

/** Ordnet eine Position der wahrscheinlichsten Straße und Fahrtrichtung zu. */
export function matchPosition(
  graph: RoadGraph,
  p: XY,
  heading: number | null,
  prev: Match | null,
  cfg: MatchConfig = DEFAULT_MATCH_CONFIG,
): Match | null {
  const list: Candidate[] = [];
  for (const way of graph.waysNear(p, cfg.radiusM)) {
    const c = candidatesOn(way, p, heading, prev, cfg);
    if (c) list.push(c);
  }
  if (list.length === 0) return null;
  list.sort((x, y) => x.score - y.score);
  const best = list[0]!;
  const second = list[1];
  best.match.confident = !second || second.score - best.score >= cfg.confidentMargin;
  return best.match;
}
