import type { OsmWay } from './types';
import { tileKey, type Tile } from './tiles';
import type { RoadDataSource } from './roadDataSource';

/** Speicher für Straßendaten je Kachel (auf dem Gerät: Dateien). */
export interface TileCache {
  get(key: string): Promise<{ savedAt: number; ways: OsmWay[] } | null>;
  put(key: string, ways: OsmWay[], savedAt: number): Promise<void>;
  has(key: string): Promise<boolean>;
}

export interface TileLoaderOptions {
  cache?: TileCache;
  /** Quelle bei Speicher-Fehlschlag (Overpass, später ein eigenes Backend) */
  source?: RoadDataSource;
  /** Alternativ: Netzabruf als Funktion (für Tests) */
  fetchTile?: (tile: Tile) => Promise<OsmWay[]>;
  now?: () => number;
  /** Daten jünger als dies gelten als frisch (Standard 30 Tage) */
  freshMs?: number;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

export type TileSource = 'cache' | 'network' | 'stale-cache';

/**
 * Lädt Straßendaten je Kachel: erst aus dem Speicher (wenn frisch), sonst aus dem Netz.
 * Schlägt das Netz fehl, werden ältere gespeicherte Daten verwendet (Offline-Betrieb).
 */
export class TileLoader implements RoadDataSource {
  private readonly cache?: TileCache;
  private readonly fetchTile: (tile: Tile) => Promise<OsmWay[]>;
  private readonly now: () => number;
  private readonly freshMs: number;

  constructor(o: TileLoaderOptions = {}) {
    this.cache = o.cache;
    this.now = o.now ?? Date.now;
    this.freshMs = o.freshMs ?? 30 * DAY_MS;
    const source = o.source;
    if (!o.fetchTile && !source) throw new Error('TileLoader braucht eine Quelle (source) oder fetchTile');
    this.fetchTile = o.fetchTile ?? ((tile) => source!.loadTile(tile));
    this.name = `cache+${source?.name ?? 'fetch'}`;
  }

  readonly name: string;

  /** Als RoadDataSource: Speicher zuerst, sonst die Quelle dahinter (und veraltete Daten bei Netzfehlern). */
  async loadTile(tile: Tile): Promise<OsmWay[]> {
    return (await this.load(tile)).ways;
  }

  async load(tile: Tile): Promise<{ ways: OsmWay[]; source: TileSource }> {
    const key = tileKey(tile);
    const cached = this.cache ? await this.cache.get(key).catch(() => null) : null;
    if (cached && this.now() - cached.savedAt <= this.freshMs) return { ways: cached.ways, source: 'cache' };
    try {
      const ways = await this.fetchTile(tile);
      await this.cache?.put(key, ways, this.now()).catch(() => undefined);
      return { ways, source: 'network' };
    } catch (e) {
      if (cached) return { ways: cached.ways, source: 'stale-cache' };
      throw e;
    }
  }

  /** Liegt die Kachel gespeichert vor (egal wie alt)? */
  has(tile: Tile): Promise<boolean> {
    return this.cache ? this.cache.has(tileKey(tile)).catch(() => false) : Promise.resolve(false);
  }
}

export interface PrefetchProgress {
  done: number;
  total: number;
  /** Kacheln, die schon gespeichert waren oder jetzt geladen wurden */
  failed: number;
}

/**
 * Lädt alle Kacheln einer Liste vorab (z. B. entlang einer Strecke). Bereits gespeicherte, frische Kacheln
 * kosten nichts. Zwischen zwei Abrufen wird kurz gewartet, um die öffentlichen Server zu schonen.
 */
export async function prefetchTiles(
  tiles: Tile[],
  loader: TileLoader,
  opts: {
    onProgress?: (p: PrefetchProgress) => void;
    shouldStop?: () => boolean;
    pauseMs?: number;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<PrefetchProgress> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const progress: PrefetchProgress = { done: 0, total: tiles.length, failed: 0 };
  for (const tile of tiles) {
    if (opts.shouldStop?.()) break;
    let fromNetwork = false;
    try {
      const r = await loader.load(tile);
      fromNetwork = r.source === 'network';
      if (r.source === 'stale-cache') progress.failed++;
    } catch {
      progress.failed++;
    }
    progress.done++;
    opts.onProgress?.({ ...progress });
    if (fromNetwork) await sleep(opts.pauseMs ?? 400);
  }
  return progress;
}
