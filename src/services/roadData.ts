import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import {
  DEFAULT_MAX_REQUESTS_PER_MINUTE,
  resolveEndpoints,
  userAgentFor,
  type RoadDataBuildConfig,
} from '../freeride/roadDataConfig';
import { OverpassSource, type RoadDataSource } from '../freeride/roadDataSource';
import { TileLoader, type TileCache } from '../freeride/tileLoader';
import type { OsmWay } from '../freeride/types';
import { useSettingsStore } from '../stores/settingsStore';

const dir = () => new Directory(Paths.document, 'osm');
const fileFor = (key: string) => new File(dir(), `${key}.json`);

/** Gespeicherte Straßendaten je Kachel als Dateien im Dokumentenordner (bleiben auch ohne Netz verfügbar). */
export const tileCache: TileCache = {
  async get(key) {
    const f = fileFor(key);
    if (!f.exists) return null;
    try {
      const data = JSON.parse(await f.text()) as { savedAt: number; ways: OsmWay[] };
      return Array.isArray(data.ways) ? data : null;
    } catch {
      return null;
    }
  },
  async put(key, ways, savedAt) {
    const d = dir();
    if (!d.exists) d.create({ intermediates: true });
    const f = fileFor(key);
    if (!f.exists) f.create();
    f.write(JSON.stringify({ savedAt, ways }));
  },
  async has(key) {
    return fileFor(key).exists;
  },
};

/** Konfiguration aus dem Build (`extra.roadData` in app.config.ts). */
function buildConfig(): RoadDataBuildConfig | undefined {
  return (Constants.expoConfig?.extra as { roadData?: RoadDataBuildConfig } | undefined)?.roadData;
}

function createOverpassSource(): OverpassSource {
  const build = buildConfig();
  return new OverpassSource({
    endpoints: resolveEndpoints(build, useSettingsStore.getState().overpassUrl),
    userAgent: userAgentFor(Constants.expoConfig?.version, build?.contact),
    maxRequestsPerMinute: build?.maxRequestsPerMinute ?? DEFAULT_MAX_REQUESTS_PER_MINUTE,
  });
}

/** Wirft `err.noRoadServer`, wenn der Build keine öffentlichen Server erlaubt und kein eigener eingerichtet ist. */
export function assertRoadDataConfigured(): void {
  resolveEndpoints(buildConfig(), useSettingsStore.getState().overpassUrl);
}

/**
 * Straßendaten für die Freie Fahrt und das Vorladen: Speicher auf dem Gerät, dahinter Overpass.
 * Server: eigener aus den Einstellungen, dann der aus dem Build, dann (nur wenn der Build es erlaubt) die
 * öffentlichen. Die Server werden erst beim ersten Netzabruf bestimmt, damit Seiten, die nur den Speicher
 * abfragen, auch ohne eingerichteten Server funktionieren; dann wirft der Abruf `err.noRoadServer`.
 */
export function createTileLoader(): TileLoader {
  let source: OverpassSource | null = null;
  const lazy: RoadDataSource = {
    name: 'overpass',
    loadTile: (tile) => (source ??= createOverpassSource()).loadTile(tile),
  };
  return new TileLoader({ cache: tileCache, source: lazy });
}

export interface CacheInfo {
  tiles: number;
  bytes: number;
}

export function cacheInfo(): CacheInfo {
  const d = dir();
  if (!d.exists) return { tiles: 0, bytes: 0 };
  let tiles = 0;
  let bytes = 0;
  for (const e of d.list()) {
    if (e instanceof File) {
      tiles++;
      bytes += e.size ?? 0;
    }
  }
  return { tiles, bytes };
}

export function clearTileCache(): void {
  const d = dir();
  if (d.exists) d.delete();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
