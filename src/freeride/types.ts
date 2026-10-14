import type { LatLon } from '../geo/types';

/** Eine Straße aus OpenStreetMap (Overpass `out geom`). */
export interface OsmWay {
  id: number;
  /** Knoten-IDs; gemeinsame IDs verschiedener Ways sind Kreuzungen */
  nodes: number[];
  geometry: LatLon[];
  tags: Record<string, string>;
}
