import type { LatLon } from '../geo/types';
import { ROAD_CLASSES } from './overpassClient';

/** Kachel im Web-Mercator-Raster (wie Kartenkacheln). Zoom 14 ≈ 2,4 km am Äquator, ≈ 1,7 km bei 46° Breite. */
export interface Tile {
  z: number;
  x: number;
  y: number;
}

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export const TILE_ZOOM = 14;

const MAX_LAT = 85.0511;

export function tileOf(p: LatLon, z = TILE_ZOOM): Tile {
  const n = 2 ** z;
  const lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, p.lat));
  const x = Math.floor(((p.lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { z, x: Math.min(n - 1, Math.max(0, x)), y: Math.min(n - 1, Math.max(0, y)) };
}

export const tileKey = (t: Tile) => `${t.z}_${t.x}_${t.y}`;

export function tileBounds(t: Tile): Bounds {
  const n = 2 ** t.z;
  const lon = (x: number) => (x / n) * 360 - 180;
  const lat = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return { west: lon(t.x), east: lon(t.x + 1), north: lat(t.y), south: lat(t.y + 1) };
}

/** Alle Kacheln, die den Kreis um `center` mit Radius `marginM` berühren (meist 1, an Rändern bis 4). */
export function tilesNear(center: LatLon, marginM: number, z = TILE_ZOOM): Tile[] {
  const dLat = marginM / 111_320;
  const dLon = marginM / (111_320 * Math.max(0.05, Math.cos((center.lat * Math.PI) / 180)));
  const a = tileOf({ lat: center.lat + dLat, lon: center.lon - dLon }, z);
  const b = tileOf({ lat: center.lat - dLat, lon: center.lon + dLon }, z);
  const out: Tile[] = [];
  for (let x = a.x; x <= b.x; x++) for (let y = a.y; y <= b.y; y++) out.push({ z, x, y });
  return out;
}

/** Kacheln entlang einer Linie (z. B. einer Strecke), mit `buffer` Kacheln Rand rundherum. */
export function tilesAlong(points: LatLon[], buffer = 1, z = TILE_ZOOM): Tile[] {
  const seen = new Map<string, Tile>();
  const add = (t: Tile) => seen.set(tileKey(t), t);
  for (const p of points) {
    const c = tileOf(p, z);
    for (let dx = -buffer; dx <= buffer; dx++) for (let dy = -buffer; dy <= buffer; dy++) add({ z, x: c.x + dx, y: c.y + dy });
  }
  return [...seen.values()];
}

/** Overpass-Abfrage aller befahrbaren Straßen in einer Kachel. */
export function buildTileQuery(t: Tile): string {
  const b = tileBounds(t);
  return (
    `[out:json][timeout:25];` +
    `way["highway"~"^(${ROAD_CLASSES.join('|')})$"](${b.south.toFixed(6)},${b.west.toFixed(6)},${b.north.toFixed(6)},${b.east.toFixed(6)});` +
    `out geom;`
  );
}
