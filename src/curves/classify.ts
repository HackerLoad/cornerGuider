import type { CurveConfig } from './config';
import type { Grade } from './types';

/** Rallye-Skala 1–6 aus dem Mindestradius; im Zweifel enger (Sicherheitsfaktor). */
export function gradeForRadius(minRadius: number, cfg: CurveConfig): Grade {
  const r = minRadius * cfg.radiusSafetyFactor;
  for (let i = 0; i < cfg.gradeMaxRadiusM.length; i++) {
    if (r <= cfg.gradeMaxRadiusM[i]!) return (i + 1) as Grade;
  }
  return 6;
}
