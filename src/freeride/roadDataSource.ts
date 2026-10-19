import { RateLimiter } from './rateLimiter';
import { fetchOverpass } from './overpassClient';
import { buildTileQuery, type Tile } from './tiles';
import type { OsmWay } from './types';

/**
 * Quelle der Straßendaten für die Freie Fahrt. Dahinter können Overpass, gespeicherte Kacheln (`TileLoader`)
 * und später ein eigenes Backend stehen; die Freie Fahrt kennt nur diese Schnittstelle.
 */
export interface RoadDataSource {
  /** Kurzer Name für Logs und Fehlermeldungen */
  readonly name: string;
  /** Straßen einer Kachel (z/x/y, Zoom 14). Wirft bei Fehlern; eine leere Liste heißt „keine Straßen". */
  loadTile(tile: Tile): Promise<OsmWay[]>;
}

export interface OverpassSourceOptions {
  /** Server in der Reihenfolge der Anfrage (bei Fehlern wird weitergewechselt) */
  endpoints: string[];
  /** Eindeutiger User-Agent mit Kontakt, wie von den Overpass-Betreibern verlangt */
  userAgent: string;
  maxRequestsPerMinute: number;
  attempts?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/** Straßendaten per Overpass-Abfrage, mit eindeutigem User-Agent und Begrenzung der Anfragen pro Minute. */
export class OverpassSource implements RoadDataSource {
  private readonly limiter: RateLimiter;

  constructor(private readonly o: OverpassSourceOptions) {
    this.limiter = new RateLimiter(o.maxRequestsPerMinute, o.now, o.sleep);
  }

  get name(): string {
    return `overpass(${this.o.endpoints.join(', ')})`;
  }

  loadTile(tile: Tile): Promise<OsmWay[]> {
    return fetchOverpass(buildTileQuery(tile), {
      endpoints: this.o.endpoints,
      userAgent: this.o.userAgent,
      attempts: this.o.attempts,
      timeoutMs: this.o.timeoutMs,
      fetchFn: this.o.fetchFn,
      sleep: this.o.sleep,
      // Leere Kacheln (Wald, Wasser) sind erlaubt, brauchen aber die Bestätigung durch einen zweiten Server
      allowEmpty: true,
      // Jede HTTP-Anfrage zählt, auch die Wiederholungen nach Fehlern
      beforeRequest: () => this.limiter.acquire(),
    });
  }
}
