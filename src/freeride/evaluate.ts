import { dist } from '../geo/polyline';
import type { XY } from '../geo/types';
import type { Curve } from '../curves';

export interface AnnouncedCurve {
  start: XY;
  grade: number;
  direction: 'left' | 'right';
}

export interface EvalOptions {
  /** Höchstabstand der Kurvenanfänge für eine Übereinstimmung (m) */
  posTolM: number;
  /** Erlaubte Abweichung der Stufe */
  gradeTol: number;
  /** Für die Trefferquote zählen nur tatsächliche Kurven bis zu dieser Stufe (1–4 = relevante) */
  maxGrade: number;
  /** Nur tatsächliche Kurven in diesem Bereich zählen (dort lagen Daten und Fahrt vor) */
  inRegion: (p: XY) => boolean;
}

export const DEFAULT_EVAL: EvalOptions = { posTolM: 40, gradeTol: 1, maxGrade: 4, inRegion: () => true };

export interface EvalResult {
  announced: number;
  /** angesagte Kurven, die es tatsächlich gab (Position, Richtung, Stufe ±tol) */
  correct: number;
  /** Anteil richtiger Ansagen (1 = keine Falschmeldungen) */
  precision: number;
  actual: number;
  recalled: number;
  /** Anteil der tatsächlichen Kurven (≤ maxGrade), die angesagt wurden */
  recall: number;
  /** angesagte Kurven ohne Gegenstück */
  falseAlarms: AnnouncedCurve[];
  /** tatsächliche Kurven, die nicht angesagt wurden */
  missed: Curve[];
}

/** Vergleicht die angesagten Kurven mit den Kurven der tatsächlich gefahrenen Spur. */
export function evaluateAnnouncements(
  announced: AnnouncedCurve[],
  actual: Curve[],
  opts: Partial<EvalOptions> = {},
): EvalResult {
  const o = { ...DEFAULT_EVAL, ...opts };
  const used = new Set<number>();
  const falseAlarms: AnnouncedCurve[] = [];
  let correct = 0;

  for (const a of announced) {
    let best = -1;
    let bestD = Infinity;
    actual.forEach((c, i) => {
      if (used.has(i) || c.direction !== a.direction || Math.abs(c.grade - a.grade) > o.gradeTol) return;
      const d = dist(c.startXY, a.start);
      if (d <= o.posTolM && d < bestD) {
        best = i;
        bestD = d;
      }
    });
    if (best >= 0) {
      used.add(best);
      correct++;
    } else {
      falseAlarms.push(a);
    }
  }

  const relevant = actual.filter((c) => c.grade <= o.maxGrade && o.inRegion(c.startXY));
  const missed = relevant.filter((c) => !announced.some(
    (a) => a.direction === c.direction && Math.abs(c.grade - a.grade) <= o.gradeTol && dist(c.startXY, a.start) <= o.posTolM,
  ));
  const recalled = relevant.length - missed.length;
  return {
    announced: announced.length,
    correct,
    precision: announced.length === 0 ? 1 : correct / announced.length,
    actual: relevant.length,
    recalled,
    recall: relevant.length === 0 ? 1 : recalled / relevant.length,
    falseAlarms,
    missed,
  };
}
