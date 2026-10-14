import { detectCurvesXY } from '../curves';
import { makeProjection } from '../geo/projection';
import { evaluateAnnouncements, type EvalResult } from './evaluate';
import type { FreerideRecording } from './session';

export interface RecordingSummary {
  distanceKm: number;
  durationMin: number;
  /** Anteil der Fahrzeit mit sicher zugeordneter Straße */
  okShare: number;
  /** Anteil der Schritte, in denen der Pfad an einer Kreuzung oder am Datenende endete, bevor der Horizont erreicht war */
  shortPathShare: number;
  eval: EvalResult;
}

/**
 * Wertet eine Fahrt aus: aus der gefahrenen Spur werden die tatsächlichen Kurven berechnet
 * und mit den angesagten verglichen.
 */
export function evaluateRecording(rec: FreerideRecording): RecordingSummary | null {
  if (rec.fixes.length < 10) return null;
  const proj = makeProjection(rec.origin);
  const xy = rec.fixes.map((f) => proj.toXY(f));
  // Normale Glättung: Die Positionen liegen nur ~15 m auseinander, stärkeres Glätten würde Spitzkehren zu
  // sanften Kurven machen und richtige Ansagen als falsch erscheinen lassen.
  const det = detectCurvesXY(xy, rec.origin);
  const startDistOf = new Map(det.curves.map((c) => [c.startXY, c.startDist]));
  const announced = rec.announcements.flatMap((a) => a.curves);
  const res = evaluateAnnouncements(announced, det.curves, {
    maxGrade: 4,
    // Anfang und Ende der Fahrt aussparen: dort fehlt der Vorlauf bzw. die Kurve ist angeschnitten
    inRegion: (p) => {
      const sd = startDistOf.get(p) ?? 0;
      return sd > 150 && sd < det.length - 100;
    },
  });
  const s = rec.stats;
  const shortPaths = (s.endReasons.junction ?? 0) + (s.endReasons.dataEnd ?? 0) + (s.endReasons.roundabout ?? 0);
  return {
    distanceKm: det.length / 1000,
    durationMin: (rec.endedAt - rec.startedAt) / 60_000,
    okShare: s.steps ? s.ok / s.steps : 0,
    shortPathShare: s.steps ? shortPaths / s.steps : 0,
    eval: res,
  };
}
