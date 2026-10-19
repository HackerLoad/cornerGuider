import { AppError } from '../../src/errors';
import { RateLimiter } from '../../src/freeride/rateLimiter';
import { OVERPASS_ENDPOINTS } from '../../src/freeride/overpassClient';
import { resolveEndpoints, userAgentFor } from '../../src/freeride/roadDataConfig';
import { OverpassSource } from '../../src/freeride/roadDataSource';
import { TileLoader, type TileCache } from '../../src/freeride/tileLoader';
import { MockRoadDataSource } from './mockRoadDataSource';
import { way } from './net';

const tile = { z: 14, x: 8800, y: 5900 };
const reply = (json: unknown, ok = true, status = 200) => ({ ok, status, json: async () => json }) as unknown as Response;
const oneWay = {
  elements: [{ type: 'way', id: 7, nodes: [1, 2], geometry: [{ lat: 47, lon: 11 }, { lat: 47.001, lon: 11 }], tags: { highway: 'primary' } }],
};

describe('RateLimiter', () => {
  function clock() {
    const c = { t: 0, slept: [] as number[] };
    return {
      c,
      now: () => c.t,
      sleep: async (ms: number) => {
        c.slept.push(ms);
        c.t += ms;
      },
    };
  }

  it('lässt bis zum Limit sofort durch, danach wartet es bis das älteste Fenster abläuft', async () => {
    const { c, now, sleep } = clock();
    const l = new RateLimiter(3, now, sleep);
    await l.acquire();
    c.t += 1000;
    await l.acquire();
    c.t += 1000;
    await l.acquire();
    expect(c.slept).toEqual([]);
    await l.acquire(); // 4. Anfrage: erst wenn die erste (t=0) 60 s her ist
    expect(c.slept.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(58_000);
    expect(c.t).toBeGreaterThanOrEqual(60_000);
  });

  it('nie mehr als das Limit in einem 60-s-Fenster', async () => {
    const { c, now, sleep } = clock();
    const l = new RateLimiter(5, now, sleep);
    const times: number[] = [];
    for (let i = 0; i < 23; i++) {
      await l.acquire();
      times.push(c.t);
    }
    for (const t of times) expect(times.filter((x) => x >= t && x < t + 60_000).length).toBeLessThanOrEqual(5);
  });

  it('Limit 0 oder weniger gilt als mindestens 1', async () => {
    const { now, sleep } = clock();
    const l = new RateLimiter(0, now, sleep);
    await expect(l.acquire()).resolves.toBeUndefined();
  });
});

describe('OverpassSource', () => {
  const base = { sleep: async () => undefined, now: () => 0 };

  it('sendet den eindeutigen User-Agent und fragt den konfigurierten Server zuerst', async () => {
    const calls: { url: string; ua: string; body: string }[] = [];
    const fetchFn = jest.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, ua: (init.headers as Record<string, string>)['User-Agent']!, body: String(init.body) });
      return reply(oneWay);
    });
    const src = new OverpassSource({
      ...base,
      endpoints: ['https://roads.example.org/api/interpreter', 'https://fallback.example.org/api/interpreter'],
      userAgent: 'cornerGuider/9.9 (+mailto:test@example.org)',
      maxRequestsPerMinute: 30,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    const ways = await src.loadTile(tile);
    expect(ways).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://roads.example.org/api/interpreter');
    expect(calls[0]!.ua).toBe('cornerGuider/9.9 (+mailto:test@example.org)');
    expect(calls[0]!.body).toContain('data=');
    expect(src.name).toContain('roads.example.org');
  });

  it('begrenzt die HTTP-Anfragen pro Minute – auch Wiederholungen nach Fehlern zählen', async () => {
    const stamps: number[] = [];
    const clock = { t: 0 };
    const sleep = async (ms: number) => {
      clock.t += ms;
    };
    const fetchFn = jest.fn(async () => {
      stamps.push(clock.t);
      return reply({}, false, 504);
    });
    const src = new OverpassSource({
      endpoints: ['a', 'b'],
      userAgent: 'x',
      maxRequestsPerMinute: 2,
      fetchFn: fetchFn as unknown as typeof fetch,
      sleep,
      now: () => clock.t,
      attempts: 4,
    });
    await expect(src.loadTile(tile)).rejects.toThrow();
    expect(stamps).toHaveLength(4);
    for (const t of stamps) expect(stamps.filter((x) => x >= t && x < t + 60_000).length).toBeLessThanOrEqual(2);
  });

  it('läuft als Quelle hinter dem TileLoader: Speicher zuerst, Netz nur einmal', async () => {
    const store = new Map<string, { savedAt: number; ways: ReturnType<typeof way>[] }>();
    const cache: TileCache = {
      get: async (k) => store.get(k) ?? null,
      put: async (k, ways, savedAt) => void store.set(k, { savedAt, ways }),
      has: async (k) => store.has(k),
    };
    const fetchFn = jest.fn(async () => reply(oneWay));
    const src = new OverpassSource({ ...base, endpoints: ['a'], userAgent: 'x', maxRequestsPerMinute: 30, fetchFn: fetchFn as unknown as typeof fetch });
    const loader = new TileLoader({ cache, source: src, now: () => 1000 });
    expect((await loader.loadTile(tile)).length).toBe(1);
    expect((await loader.loadTile(tile)).length).toBe(1);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(loader.name).toContain('a');
  });
});

describe('MockRoadDataSource', () => {
  it('liefert feste Straßen und merkt sich die angefragten Kacheln', async () => {
    const m = new MockRoadDataSource([way(1, [1, 2], [[0, 0], [0, 100]])]);
    expect(await m.loadTile(tile)).toHaveLength(1);
    expect(m.calls).toBe(1);
    expect(m.requested[0]).toEqual(tile);
  });
  it('kann Fehler und leere Kacheln liefern', async () => {
    await expect(new MockRoadDataSource(async () => Promise.reject(new Error('504'))).loadTile(tile)).rejects.toThrow('504');
    expect(await new MockRoadDataSource().loadTile(tile)).toEqual([]);
  });
});

describe('Server-Konfiguration (Build und Einstellungen)', () => {
  it('Reihenfolge: eigener Server aus den Einstellungen, Server aus dem Build, dann öffentliche', () => {
    expect(resolveEndpoints({ url: 'https://build.example/api', allowPublic: true }, ' https://user.example/api ')).toEqual([
      'https://user.example/api',
      'https://build.example/api',
      ...OVERPASS_ENDPOINTS,
    ]);
  });

  it('ohne Build-Server und Einstellung: nur die öffentlichen (Entwicklung)', () => {
    expect(resolveEndpoints({ allowPublic: true }, '')).toEqual(OVERPASS_ENDPOINTS);
    expect(resolveEndpoints(undefined, '')).toEqual(OVERPASS_ENDPOINTS);
  });

  it('Release-Modus: öffentliche Server sind gesperrt', () => {
    expect(resolveEndpoints({ url: 'https://build.example/api', allowPublic: false }, '')).toEqual(['https://build.example/api']);
  });

  it('Release-Modus ohne eigenen Server: klarer Fehler statt stiller Nutzung der öffentlichen Server', () => {
    try {
      resolveEndpoints({ allowPublic: false }, '');
      throw new Error('hätte werfen müssen');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).key).toBe('err.noRoadServer');
    }
  });

  it('Doppelte Adressen und Leerzeichen werden bereinigt', () => {
    const r = resolveEndpoints({ url: 'https://a/api', allowPublic: false }, 'https://a/api  ');
    expect(r).toEqual(['https://a/api']);
  });

  it('User-Agent enthält App, Version und Kontakt', () => {
    expect(userAgentFor('0.1.0', 'https://github.com/HackerLoad/cornerGuider')).toBe(
      'cornerGuider/0.1.0 (+https://github.com/HackerLoad/cornerGuider)',
    );
    expect(userAgentFor(undefined, '')).toMatch(/^cornerGuider\/[\w.]+ \(\+.+\)$/);
  });
});
