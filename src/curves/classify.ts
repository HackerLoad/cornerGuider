import type { CurveConfig } from './config';
import type { Grade } from './types';

/** Rallye-Skala 1–6 aus dem Mindestradius; im Zweifel enger (Sicherheitsfaktor). */
export function gradeForRadius(minRadius: number, cfg: CurveConfig): Grade {
  const r = minRadius * cfg.safetyMarginRadiusFactor;
  for (let i = 0; i < cfg.gradeMaxRadiusM.length; i++) {
    if (r <= cfg.gradeMaxRadiusM[i]!) return (i + 1) as Grade;
  }
  return 6;
}

/** Bei niedriger Konfidenz eine Stufe enger (nie unter 1): eine zu milde Ansage ist gefährlicher als eine zu strenge. */
export function tightenForConfidence(grade: Grade, confidence: number, cfg: CurveConfig): Grade {
  return confidence < cfg.reducedBelow ? (Math.max(1, grade - 1) as Grade) : grade;
}
