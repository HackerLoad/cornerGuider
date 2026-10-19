import { AppError } from '../errors';
import { OVERPASS_ENDPOINTS } from './overpassClient';

/** Konfiguration der Straßendaten aus dem Build (`extra.roadData` in app.config.ts). */
export interface RoadDataBuildConfig {
  /** Eigener Server (Overpass-Schnittstelle), im Release der Normalfall */
  url?: string;
  /** Öffentliche Overpass-Server als Ausweichziel erlauben. Im Release auf false setzen. */
  allowPublic?: boolean;
  /** Kontakt für den User-Agent (URL oder E-Mail), damit Betreiber bei Problemen jemanden erreichen */
  contact?: string;
  maxRequestsPerMinute?: number;
}

export const DEFAULT_CONTACT = 'https://github.com/HackerLoad/cornerGuider';
export const DEFAULT_MAX_REQUESTS_PER_MINUTE = 30;

/**
 * Server in der Reihenfolge der Anfrage: eigener Server aus den Einstellungen, Server aus dem Build, dann
 * (nur wenn erlaubt) die öffentlichen. Ohne jeden Server gibt es einen klaren Fehler.
 */
export function resolveEndpoints(build: RoadDataBuildConfig | undefined, userUrl: string): string[] {
  const list: string[] = [];
  const add = (u: string | undefined) => {
    const url = u?.trim();
    if (url && !list.includes(url)) list.push(url);
  };
  add(userUrl);
  add(build?.url);
  if (build?.allowPublic !== false) OVERPASS_ENDPOINTS.forEach(add);
  if (list.length === 0) throw new AppError('err.noRoadServer');
  return list;
}

export function userAgentFor(version: string | undefined, contact: string | undefined): string {
  return `cornerGuider/${version || '0'} (+${contact?.trim() || DEFAULT_CONTACT})`;
}
