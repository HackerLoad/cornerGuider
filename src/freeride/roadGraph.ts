import { cumulativeLengths } from '../geo/polyline';
import { makeProjection, type Projection } from '../geo/projection';
import type { LatLon, XY } from '../geo/types';
import type { OsmWay } from './types';

export type OneWay = 'no' | 'forward' | 'backward';

export interface GraphWay {
  id: number;
  highway: string;
  name?: string;
  ref?: string;
  oneway: OneWay;
  roundabout: boolean;
  nodes: number[];
  pts: XY[];
  cum: number[];
  length: number;
  bbox: { minX: number; maxX: number; minY: number; maxY: number };
}

export interface NodeRef {
  wayId: number;
  index: number;
}

function onewayOf(tags: Record<string, string>): OneWay {
  const v = tags.oneway;
  if (v === '-1' || v === 'reverse') return 'backward';
  if (v === 'yes' || v === '1' || v === 'true') return 'forward';
  if (tags.junction === 'roundabout') return 'forward';
  return 'no';
}

/** Straßennetz in lokalen Metern; wächst, wenn neue Gebiete nachgeladen werden. */
export class RoadGraph {
  readonly projection: Projection;
  readonly ways = new Map<number, GraphWay>();
  readonly nodeRefs = new Map<number, NodeRef[]>();

  constructor(origin: LatLon) {
    this.projection = makeProjection(origin);
  }

  /** Fügt Ways hinzu; schon bekannte IDs werden ignoriert. Gibt die Zahl neuer Ways zurück. */
  addWays(ways: OsmWay[]): number {
    let added = 0;
    for (const w of ways) {
      if (this.ways.has(w.id)) continue;
      const pts = w.geometry.map((g) => this.projection.toXY(g));
      const cum = cumulativeLengths(pts);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of pts) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
      this.ways.set(w.id, {
        id: w.id,
        highway: w.tags.highway ?? '',
        name: w.tags.name,
        ref: w.tags.ref,
        oneway: onewayOf(w.tags),
        roundabout: w.tags.junction === 'roundabout',
        nodes: w.nodes,
        pts,
        cum,
        length: cum[cum.length - 1] ?? 0,
        bbox: { minX, maxX, minY, maxY },
      });
      w.nodes.forEach((n, index) => {
        const list = this.nodeRefs.get(n);
        if (list) list.push({ wayId: w.id, index });
        else this.nodeRefs.set(n, [{ wayId: w.id, index }]);
      });
      added++;
    }
    return added;
  }

  /** Ways, deren Bounding-Box höchstens `r` m vom Punkt entfernt ist. */
  waysNear(p: XY, r: number): GraphWay[] {
    const out: GraphWay[] = [];
    for (const w of this.ways.values()) {
      const b = w.bbox;
      if (p.x < b.minX - r || p.x > b.maxX + r || p.y < b.minY - r || p.y > b.maxY + r) continue;
      out.push(w);
    }
    return out;
  }
}
