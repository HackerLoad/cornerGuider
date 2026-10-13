import { XMLParser } from 'fast-xml-parser';
import type { LatLon } from '../geo/types';

export interface ParsedGpx {
  name: string | null;
  kind: 'track' | 'route';
  points: LatLon[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['trk', 'trkseg', 'trkpt', 'rte', 'rtept'].includes(name),
});

function toPoints(list: unknown): LatLon[] {
  const out: LatLon[] = [];
  for (const raw of (list as Record<string, unknown>[] | undefined) ?? []) {
    const lat = Number(raw['@_lat']);
    const lon = Number(raw['@_lon']);
    if (Number.isFinite(lat) && Number.isFinite(lon)) out.push({ lat, lon });
  }
  return out;
}

function textOf(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Liest Track (trk) oder – falls keiner vorhanden – Route (rte) aus einer GPX-Datei. */
export function parseGpx(xml: string): ParsedGpx {
  const doc = parser.parse(xml) as { gpx?: Record<string, any> };
  const gpx = doc.gpx;
  if (!gpx) throw new Error('Keine gültige GPX-Datei');

  const trkPoints: LatLon[] = [];
  for (const trk of gpx.trk ?? []) {
    for (const seg of trk.trkseg ?? []) trkPoints.push(...toPoints(seg.trkpt));
  }
  if (trkPoints.length >= 2) {
    return { name: textOf(gpx.trk?.[0]?.name) ?? textOf(gpx.metadata?.name), kind: 'track', points: trkPoints };
  }

  const rtePoints: LatLon[] = [];
  for (const rte of gpx.rte ?? []) rtePoints.push(...toPoints(rte.rtept));
  if (rtePoints.length >= 2) {
    return { name: textOf(gpx.rte?.[0]?.name) ?? textOf(gpx.metadata?.name), kind: 'route', points: rtePoints };
  }
  throw new Error('GPX enthält weder Track noch Route mit mindestens 2 Punkten');
}
