import { DAY_MS, TileLoader, prefetchTiles, type TileCache } from '../../src/freeride/tileLoader';
import { buildTileQuery, tileBounds, tileKey, tileOf, tilesAlong, tilesNear } from '../../src/freeride/tiles';
import { fetchOverpass } from '../../src/freeride/overpassClient';
import type { OsmWay } from '../../src/freeride/types';

const way = (id: number): OsmWay => ({ id, nodes: [1, 2], geometry: [{ lat: 47, lon: 11 }, { lat: 47.001, lon: 11 }], tags: { highway: 'primary' } });

describe('Kacheln', () => {
  it('bekannte Kachel: London liegt im Raster bei Zoom 10 in Kachel 511/340', () => {
    expect(tileOf({ lat: 51.5, lon: -0.1 }, 10)).toEqual({ z: 10, x: 511, y: 340 });
  });

  it('Position liegt in den Grenzen ihrer Kachel, Kachelgröße ist plausibel', () => {
    const p = { lat: 46.5, lon: 10.5 };
    const t = tileOf(p);
    const b = tileBounds(t);
    expect(p.lat).toBeGreaterThanOrEqual(b.south);
    expect(p.lat).toBeLessThanOrEqual(b.north);
    expect(p.lon).toBeGreaterThanOrEqual(b.west);
    expect(p.lon).toBeLessThanOrEqual(b.east);
    const widthKm = (b.east - b.west) * 111.32 * Math.cos((46.5 * Math.PI) / 180);
    expect(widthKm).toBeGreaterThan(1.4);
    expect(widthKm).toBeLessThan(2.0);
  });

  it('tilesNear liefert eine Kachel in der Mitte und mehrere am Rand', () => {
    const t = tileOf({ lat: 46.5, lon: 10.5 });
    const b = tileBounds(t);
    const center = { lat: (b.north + b.south) / 2, lon: (b.east + b.west) / 2 };
    expect(tilesNear(center, 100)).toHaveLength(1);
    const corner = { lat: b.north - 0.0001, lon: b.east - 0.0001 };
    expect(tilesNear(corner, 300).length).toBeGreaterThanOrEqual(2);
  });

  it('tilesAlong: eindeutige Kacheln mit Rand', () => {
    const line = [{ lat: 46.5, lon: 10.5 }, { lat: 46.5, lon: 10.5001 }, { lat: 46.5, lon: 10.56 }];
    const tiles = tilesAlong(line, 1);
    expect(new Set(tiles.map(tileKey)).size).toBe(tiles.length);
    expect(tiles.length).toBeGreaterThanOrEqual(9);
    expect(tilesAlong(line, 0).length).toBeLessThan(tiles.length);
  });

  it('Abfrage enthält Bounding-Box und nur befahrbare Klassen', () => {
    const t = { z: 14, x: 8691, y: 5666 };
    const b = tileBounds(t);
    const q = buildTileQuery(t);
    expect(q).toContain(`(${b.south.toFixed(6)},${b.west.toFixed(6)},${b.north.toFixed(6)},${b.east.toFixed(6)})`);
    expect(b.north).toBeGreaterThan(b.south);
    expect(b.east).toBeGreaterThan(b.west);
    expect(q).toContain('primary');
    expect(q).not.toContain('footway');
  });
});

function memoryCache(): TileCache & { store: Map<string, { savedAt: number; ways: OsmWay[] }> } {
  const store = new Map<string, { savedAt: number; ways: OsmWay[] }>();
  return {
    store,
    get: async (k) => store.get(k) ?? null,
    put: async (k, ways, savedAt) => void store.set(k, { savedAt, ways }),
    has: async (k) => store.has(k),
  };
}

describe('TileLoader', () => {
  const tile = { z: 14, x: 1, y: 2 };

  it('lädt aus dem Netz, speichert und nutzt danach den Speicher', async () => {
    const cache = memoryCache();
    const fetchTile = jest.fn(async () => [way(1)]);
    const loader = new TileLoader({ cache, fetchTile, now: () => 1000 });
    expect((await loader.load(tile)).source).toBe('network');
    expect((await loader.load(tile)).source).toBe('cache');
    expect(fetchTile).toHaveBeenCalledTimes(1);
  });

  it('veraltete Daten werden neu geladen, bei Netzfehler aber weiter genutzt (offline)', async () => {
    const cache = memoryCache();
    let now = 0;
    const loader = new TileLoader({ cache, fetchTile: async () => [way(1)], now: () => now });
    await loader.load(tile);
    now = 40 * DAY_MS;
    const offline = new TileLoader({
      cache,
      fetchTile: async () => {
        throw new Error('offline');
      },
      now: () => now,
    });
    const r = await offline.load(tile);
    expect(r.source).toBe('stale-cache');
    expect(r.ways).toHaveLength(1);
    // ohne gespeicherte Daten ist der Fehler sichtbar
    await expect(offline.load({ z: 14, x: 9, y: 9 })).rejects.toThrow('offline');
  });

  it('prefetchTiles meldet Fortschritt, überspringt gespeicherte Kacheln ohne Pause und zählt Fehler', async () => {
    const cache = memoryCache();
    const loaded = { z: 14, x: 1, y: 1 };
    await cache.put(tileKey(loaded), [way(1)], 0);
    const loader = new TileLoader({
      cache,
      now: () => 1,
      fetchTile: async (t) => {
        if (t.x === 3) throw new Error('boom');
        return [way(t.x)];
      },
    });
    const sleeps: number[] = [];
    const seen: number[] = [];
    const res = await prefetchTiles([loaded, { z: 14, x: 2, y: 1 }, { z: 14, x: 3, y: 1 }], loader, {
      onProgress: (p) => seen.push(p.done),
      sleep: async (ms) => void sleeps.push(ms),
    });
    expect(res).toEqual({ done: 3, total: 3, failed: 1 });
    expect(seen).toEqual([1, 2, 3]);
    expect(sleeps).toHaveLength(1); // nur nach dem echten Netzabruf
    expect(await loader.has({ z: 14, x: 2, y: 1 })).toBe(true);
  });

  it('prefetchTiles bricht auf Wunsch ab', async () => {
    const loader = new TileLoader({ fetchTile: async () => [way(1)] });
    let n = 0;
    const res = await prefetchTiles([1, 2, 3, 4].map((x) => ({ z: 14, x, y: 1 })), loader, {
      shouldStop: () => n++ >= 2,
      sleep: async () => undefined,
    });
    expect(res.done).toBe(2);
  });
});

describe('fetchOverpass mit allowEmpty', () => {
  const empty = { ok: true, status: 200, json: async () => ({ elements: [] }) } as Response;
  const noSleep = async () => undefined;

  it('eine leere Antwort allein reicht nicht, zwei bestätigen eine leere Kachel', async () => {
    const fetchFn = jest.fn(async () => empty);
    const ways = await fetchOverpass('q', { fetchFn: fetchFn as unknown as typeof fetch, endpoints: ['a', 'b'], sleep: noSleep, allowEmpty: true });
    expect(ways).toEqual([]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('ohne allowEmpty bleibt eine leere Antwort ein Fehler', async () => {
    const fetchFn = jest.fn(async () => empty);
    await expect(fetchOverpass('q', { fetchFn: fetchFn as unknown as typeof fetch, attempts: 2, sleep: noSleep })).rejects.toThrow();
  });
});
