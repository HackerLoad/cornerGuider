import type { LatLon } from '../geo/types';
import type { OsmWay } from './types';

/** Befahrbare Straßenklassen (ohne Fuß-, Rad-, Reit- und Feldwege). */
export const ROAD_CLASSES = [
  'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street',
  'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link', 'service',
];

/** Reihenfolge nach Erfahrung: antwortet in unter einer Sekunde; der Hauptserver war zeitweise überlastet (504). */
export const OVERPASS_ENDPOINTS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

export function buildQuery(center: LatLon, radiusM: number): string {
  return (
    `[out:json][timeout:25];` +
    `way(around:${Math.round(radiusM)},${center.lat.toFixed(6)},${center.lon.toFixed(6)})` +
    `["highway"~"^(${ROAD_CLASSES.join('|')})$"];out geom;`
  );
}

/** Wandelt die Overpass-JSON-Antwort in Ways um; ungültige Einträge werden übersprungen. */
export function parseOverpass(json: unknown): OsmWay[] {
  const elements = (json as { elements?: unknown[] } | null)?.elements;
  if (!Array.isArray(elements)) throw new Error('Unerwartete Overpass-Antwort');
  const out: OsmWay[] = [];
  for (const raw of elements) {
    const e = raw as { type?: string; id?: number; nodes?: number[]; geometry?: { lat: number; lon: number }[]; tags?: Record<string, string> };
    if (e.type !== 'way' || typeof e.id !== 'number' || !e.nodes || !e.geometry) continue;
    if (e.geometry.length < 2 || e.geometry.length !== e.nodes.length) continue;
    out.push({
      id: e.id,
      nodes: e.nodes,
      geometry: e.geometry.map((g) => ({ lat: g.lat, lon: g.lon })),
      tags: e.tags ?? {},
    });
  }
  return out;
}

export interface FetchOptions {
  fetchFn?: typeof fetch;
  endpoints?: string[];
  /** Versuche insgesamt (Standard 4); jeder weitere Versuch nimmt den nächsten Server und wartet länger */
  attempts?: number;
  /** Zeitlimit je Versuch in ms (Standard 12 s) */
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  userAgent?: string;
}

export class OverpassError extends Error {}

/**
 * Lädt Straßen im Umkreis. Die öffentlichen Instanzen sind oft überlastet (504/429) oder liefern kurz
 * leere Antworten, deshalb: Zeitlimit, Wiederholung mit wachsender Wartezeit und Wechsel des Servers.
 * Eine Antwort ohne Straßen gilt als Fehler (sonst würde ein Gebiet ohne Straßen als „geladen" markiert).
 */
export async function fetchRoads(center: LatLon, radiusM: number, opts: FetchOptions = {}): Promise<OsmWay[]> {
  const doFetch = opts.fetchFn ?? fetch;
  const endpoints = opts.endpoints ?? OVERPASS_ENDPOINTS;
  const attempts = opts.attempts ?? 4;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const body = `data=${encodeURIComponent(buildQuery(center, radiusM))}`;
  let lastError: unknown = null;

  for (let i = 0; i < attempts; i++) {
    const url = endpoints[i % endpoints.length]!;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 12_000) : null;
    try {
      const res = await doFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': opts.userAgent ?? 'cornerGuider/0.1 (github.com/HackerLoad/cornerGuider)',
        },
        body,
        signal: ctrl?.signal,
      });
      if (!res.ok) throw new OverpassError(`Overpass ${url}: HTTP ${res.status}`);
      const ways = parseOverpass(await res.json());
      if (ways.length === 0) throw new OverpassError(`Overpass ${url}: keine Straßen in der Antwort`);
      return ways;
    } catch (e) {
      lastError = e;
      if (i < attempts - 1) await sleep(500 * 2 ** i);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  const reason =
    lastError instanceof Error ? (lastError.name === 'AbortError' ? 'Zeitüberschreitung' : lastError.message) : String(lastError);
  throw new OverpassError(`Straßendaten nicht verfügbar (${attempts} Versuche): ${reason}`);
}
