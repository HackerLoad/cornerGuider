import type { LatLon, XY } from './types';

const EARTH_RADIUS_M = 6371008.8;
const DEG = Math.PI / 180;

export interface Projection {
  origin: LatLon;
  toXY(p: LatLon): XY;
  toLatLon(p: XY): LatLon;
}

/** Equirectangular-Projektion um einen Ursprung (für Routen < ~100 km ausreichend genau). */
export function makeProjection(origin: LatLon): Projection {
  const cosLat = Math.cos(origin.lat * DEG);
  return {
    origin,
    toXY: (p) => ({
      x: (p.lon - origin.lon) * DEG * EARTH_RADIUS_M * cosLat,
      y: (p.lat - origin.lat) * DEG * EARTH_RADIUS_M,
    }),
    toLatLon: (p) => ({
      lat: origin.lat + p.y / (DEG * EARTH_RADIUS_M),
      lon: origin.lon + p.x / (DEG * EARTH_RADIUS_M * cosLat),
    }),
  };
}

/** Projektion um den Mittelpunkt der Bounding-Box. */
export function projectionForPoints(points: LatLon[]): Projection {
  if (points.length === 0) throw new Error('projectionForPoints: no points');
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLon = Math.min(minLon, p.lon);
    maxLon = Math.max(maxLon, p.lon);
  }
  return makeProjection({ lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 });
}
