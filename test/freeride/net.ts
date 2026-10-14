import { makeProjection } from '../../src/geo/projection';
import type { OsmWay } from '../../src/freeride/types';
import { RoadGraph } from '../../src/freeride/roadGraph';

const proj = makeProjection({ lat: 47, lon: 11 });

/** Way aus lokalen Metern (x = Ost, y = Nord) bauen. */
export function way(id: number, nodes: number[], pts: [number, number][], tags: Record<string, string> = {}): OsmWay {
  return {
    id,
    nodes,
    geometry: pts.map(([x, y]) => proj.toLatLon({ x, y })),
    tags: { highway: 'secondary', ...tags },
  };
}

export function graphOf(ways: OsmWay[]): RoadGraph {
  const g = new RoadGraph({ lat: 47, lon: 11 });
  g.addWays(ways);
  return g;
}

export { proj };
