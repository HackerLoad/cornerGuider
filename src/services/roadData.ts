import { Directory, File, Paths } from 'expo-file-system';
import { OVERPASS_ENDPOINTS } from '../freeride/overpassClient';
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

/** Lader mit Speicher; ein eigener Overpass-Server aus den Einstellungen wird zuerst angefragt. */
export function createTileLoader(): TileLoader {
  const custom = useSettingsStore.getState().overpassUrl.trim();
  return new TileLoader({
    cache: tileCache,
    fetchOptions: { endpoints: custom ? [custom, ...OVERPASS_ENDPOINTS] : OVERPASS_ENDPOINTS },
  });
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
