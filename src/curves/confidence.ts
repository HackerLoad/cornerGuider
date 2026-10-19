import type { CurveConfig } from './config';
import type { Curve } from './types';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Konfidenz aus dem größten Abstand der Original-Knoten im Kurvenbereich: fein → 1, grob → 0. */
export function geometryConfidence(maxNodeGapM: number, cfg: CurveConfig): number {
  if (maxNodeGapM <= cfg.goodNodeSpacingM) return 1;
  return clamp01(1 - (maxNodeGapM - cfg.goodNodeSpacingM) / (cfg.poorNodeSpacingM - cfg.goodNodeSpacingM));
}

/** Faktor für die Konfidenz aus der GPS-Genauigkeit (m); unbekannt = kein Abzug. */
export function gpsAccuracyFactor(accuracyM: number | null | undefined, cfg: CurveConfig): number {
  if (accuracyM == null || accuracyM <= cfg.gpsGoodAccuracyM) return 1;
  if (accuracyM >= cfg.gpsPoorAccuracyM) return cfg.gpsMinFactor;
  const t = (accuracyM - cfg.gpsGoodAccuracyM) / (cfg.gpsPoorAccuracyM - cfg.gpsGoodAccuracyM);
  return 1 - t * (1 - cfg.gpsMinFactor);
}

/**
 * Faktor für Kurven nahe dem Ende des vorhergesagten Pfads an einer unklaren Kreuzung.
 * `distToPathEndM` = Abstand vom Kurvenende bis zum Pfadende.
 */
export function junctionFactor(distToPathEndM: number, endReason: string | undefined, cfg: CurveConfig): number {
  return endReason === 'junction' && distToPathEndM <= cfg.junctionProximityM ? cfg.junctionConfidenceFactor : 1;
}

export function isUncertain(confidence: number, cfg: CurveConfig): boolean {
  return confidence < cfg.uncertainBelow;
}

/** Kopie der Kurve mit multiplizierter Konfidenz (bei Faktor 1 dieselbe Instanz). */
export function withConfidenceFactor(curve: Curve, factor: number): Curve {
  return factor === 1 ? curve : { ...curve, confidence: clamp01(curve.confidence * factor) };
}
