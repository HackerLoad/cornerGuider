import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OverpassError, buildQuery, fetchRoads, parseOverpass } from '../../src/freeride/overpassClient';

const fixture = JSON.parse(readFileSync(join(__dirname, '../fixtures/osm-amalfi.json'), 'utf8'));
const center = { lat: 40.6184, lon: 14.5156 };

describe('parseOverpass', () => {
  it('liest echte Overpass-Daten (Amalfi)', () => {
    const ways = parseOverpass(fixture);
    expect(ways.length).toBeGreaterThan(30);
    for (const w of ways) {
      expect(w.geometry.length).toBe(w.nodes.length);
      expect(w.tags.highway).toBeTruthy();
    }
    expect(ways.some((w) => w.tags.ref === 'SS163')).toBe(true);
  });

  it('überspringt Einträge ohne Geometrie und wirft bei unbekanntem Format', () => {
    expect(parseOverpass({ elements: [{ type: 'node', id: 1 }, { type: 'way', id: 2, nodes: [1, 2] }] })).toEqual([]);
    expect(() => parseOverpass({ foo: 1 })).toThrow();
  });
});

describe('buildQuery', () => {
  it('enthält Umkreis, Mittelpunkt und nur befahrbare Straßenklassen', () => {
    const q = buildQuery(center, 1500);
    expect(q).toContain('around:1500,40.618400,14.515600');
    expect(q).toContain('primary');
    expect(q).not.toContain('footway');
    expect(q).not.toContain('track');
  });
});

describe('fetchRoads', () => {
  const ok = { ok: true, status: 200, json: async () => fixture } as Response;
  const bad = (status: number) => ({ ok: false, status, json: async () => ({}) }) as Response;
  const noSleep = async () => undefined;

  it('liefert Ways bei Erfolg und sendet einen User-Agent', async () => {
    const fetchFn = jest.fn(async () => ok);
    const ways = await fetchRoads(center, 1000, { fetchFn: fetchFn as unknown as typeof fetch, sleep: noSleep });
    expect(ways.length).toBeGreaterThan(30);
    const init = (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)['User-Agent']).toContain('cornerGuider');
    expect(init.method).toBe('POST');
  });

  it('wiederholt bei 504 mit dem nächsten Server und wartet länger', async () => {
    const urls: string[] = [];
    const sleeps: number[] = [];
    const responses = [bad(504), bad(429), ok];
    const fetchFn = jest.fn(async (url: string) => {
      urls.push(url);
      return responses.shift()!;
    });
    const ways = await fetchRoads(center, 1000, {
      fetchFn: fetchFn as unknown as typeof fetch,
      endpoints: ['https://a', 'https://b'],
      sleep: async (ms) => void sleeps.push(ms),
    });
    expect(ways.length).toBeGreaterThan(0);
    expect(urls).toEqual(['https://a', 'https://b', 'https://a']);
    expect(sleeps).toEqual([500, 1000]);
  });

  it('behandelt eine leere Antwort wie einen Fehler und fragt den nächsten Server', async () => {
    const empty = { ok: true, status: 200, json: async () => ({ elements: [] }) } as Response;
    const urls: string[] = [];
    const responses = [empty, ok];
    const fetchFn = jest.fn(async (url: string) => {
      urls.push(url);
      return responses.shift()!;
    });
    const ways = await fetchRoads(center, 1000, {
      fetchFn: fetchFn as unknown as typeof fetch,
      endpoints: ['https://a', 'https://b'],
      sleep: noSleep,
    });
    expect(ways.length).toBeGreaterThan(0);
    expect(urls).toEqual(['https://a', 'https://b']);
  });

  it('meldet ein Zeitlimit lesbar statt „Aborted"', async () => {
    const abort = Object.assign(new Error('Aborted'), { name: 'AbortError' });
    const fetchFn = jest.fn(async () => {
      throw abort;
    });
    await expect(
      fetchRoads(center, 1000, { fetchFn: fetchFn as unknown as typeof fetch, attempts: 2, sleep: noSleep }),
    ).rejects.toThrow(/Zeitüberschreitung/);
  });

  it('wirft einen verständlichen Fehler nach allen Versuchen', async () => {
    const fetchFn = jest.fn(async () => bad(504));
    await expect(
      fetchRoads(center, 1000, { fetchFn: fetchFn as unknown as typeof fetch, attempts: 3, sleep: noSleep }),
    ).rejects.toThrow(OverpassError);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});
