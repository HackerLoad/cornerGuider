import { detectCurves, type Curve } from '../curves';
import type { XY } from '../geo/types';
import { parseGpx } from '../gpx/parseGpx';

/** Auf der Platte gespeicherte Route inkl. vorberechneter Kurven. */
export interface StoredRoute {
  version: 1;
  id: string;
  name: string;
  kind: 'track' | 'route';
  importedAt: number;
  lengthM: number;
  warnings: string[];
  projectionOrigin: { lat: number; lon: number };
  /** Resampelte Route (≈5 m Abstand), lokale Meter; Distanz ergibt sich aus cumulativeLengths */
  path: XY[];
  curves: Curve[];
}

export interface RouteSummary {
  id: string;
  name: string;
  importedAt: number;
  lengthM: number;
  curveCount: number;
}

/** Ab diesem mittleren Punktabstand sind die Kurven unzuverlässig (z. B. nur Wegpunkte). */
export const MAX_AVG_POINT_SPACING_M = 100;

const round1 = (n: number) => Math.round(n * 10) / 10;
const roundXY = (p: XY): XY => ({ x: round1(p.x), y: round1(p.y) });

export function buildStoredRoute(gpxText: string, fallbackName: string, now = Date.now()): StoredRoute {
  const gpx = parseGpx(gpxText);
  const res = detectCurves(gpx.points);

  const warnings: string[] = [];
  const avgSpacing = res.length / Math.max(1, gpx.points.length - 1);
  if (avgSpacing > MAX_AVG_POINT_SPACING_M) {
    warnings.push(
      `Die Datei enthält nur wenige Punkte (Ø ${Math.round(avgSpacing)} m Abstand). ` +
        'Kurven können fehlen oder ungenau sein – bitte den Track statt der Route exportieren.',
    );
  }
  if (gpx.kind === 'route') {
    warnings.push('Die Datei enthält eine Route ohne aufgezeichneten Track; die Genauigkeit hängt vom Export ab.');
  }
  if (res.curves.length === 0) warnings.push('Auf dieser Strecke wurden keine Kurven erkannt.');

  const curves = res.curves.map((c) => ({
    ...c,
    minRadius: round1(c.minRadius),
    totalAngle: round1(c.totalAngle),
    startDist: round1(c.startDist),
    endDist: round1(c.endDist),
    length: round1(c.length),
    gapToPrevious: c.gapToPrevious === null ? null : round1(c.gapToPrevious),
    geometry: c.geometry.map(roundXY),
  }));

  return {
    version: 1,
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: gpx.name ?? fallbackName,
    kind: gpx.kind,
    importedAt: now,
    lengthM: round1(res.length),
    warnings,
    projectionOrigin: res.projectionOrigin,
    path: res.path.map(roundXY),
    curves,
  };
}

export function summarize(r: StoredRoute): RouteSummary {
  return { id: r.id, name: r.name, importedAt: r.importedAt, lengthM: r.lengthM, curveCount: r.curves.length };
}
