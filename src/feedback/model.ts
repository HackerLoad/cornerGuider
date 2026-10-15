import { makeProjection } from '../geo/projection';
import type { FreerideRecording } from '../freeride/session';

/** Bewertung einer angesagten Kurve nach der Fahrt. */
export type CurveRating = 'ok' | 'tooMild' | 'tooHard' | 'notThere';
export const RATINGS: CurveRating[] = ['ok', 'tooMild', 'tooHard', 'notThere'];

/** Kurze Markierung während der Fahrt (z. B. vom Beifahrer): Ansage war falsch oder eine Kurve fehlte. */
export type MarkKind = 'wrong' | 'missing';

export interface FeedbackMark {
  id: string;
  /** Zeitpunkt (ms, epoch) */
  t: number;
  lat: number;
  lon: number;
  kind: MarkKind;
  source: 'route' | 'free';
  routeId?: string;
  /** Entfernung entlang der Strecke (m), nur bei geplanter Route */
  distAlongM?: number;
  /** Aktuelle bzw. nächste Kurve zum Zeitpunkt der Markierung */
  curve?: { direction: 'left' | 'right'; grade: number };
  note?: string;
}

/** Schlüssel einer angesagten Kurve innerhalb einer Aufzeichnung: Zeitpunkt der Ansage und Position darin. */
export const curveKey = (announcementT: number, indexInAnnouncement: number) => `${announcementT}:${indexInAnnouncement}`;

export interface RatedCurve {
  key: string;
  t: number;
  direction: 'left' | 'right';
  grade: number;
  rating?: CurveRating;
}

/** Alle angesagten Kurven einer Aufzeichnung in Fahrtreihenfolge, mit ihrer Bewertung. */
export function ratedCurves(rec: FreerideRecording): RatedCurve[] {
  const out: RatedCurve[] = [];
  for (const a of rec.announcements) {
    a.curves.forEach((c, i) => {
      const key = curveKey(a.t, i);
      out.push({ key, t: a.t, direction: c.direction, grade: c.grade, rating: rec.ratings?.[key] });
    });
  }
  return out;
}

/** Zurückgelegte Strecke (m) bis zum Zeitpunkt `t`, aus den aufgezeichneten Positionen. */
export function distanceAtTime(rec: FreerideRecording, t: number): number {
  if (rec.fixes.length < 2) return 0;
  const proj = makeProjection(rec.origin);
  let dist = 0;
  let prev = proj.toXY(rec.fixes[0]!);
  for (let i = 1; i < rec.fixes.length; i++) {
    const f = rec.fixes[i]!;
    if (f.t > t) break;
    const p = proj.toXY(f);
    dist += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return dist;
}

export interface GradeStats {
  total: number;
  ok: number;
  tooMild: number;
  tooHard: number;
  notThere: number;
}

export interface RatingSummary {
  rated: number;
  byGrade: Record<number, GradeStats>;
  /** Auffälligkeiten, bei denen sich eine Anpassung lohnt (ab 5 Bewertungen je Stufe und 40 % Abweichung) */
  hints: { grade: number; kind: 'tooMild' | 'tooHard' | 'notThere'; share: number }[];
}

export const HINT_MIN_RATINGS = 5;
export const HINT_MIN_SHARE = 0.4;

export function summarizeRatings(curves: { grade: number; rating?: CurveRating }[]): RatingSummary {
  const byGrade: Record<number, GradeStats> = {};
  let rated = 0;
  for (const c of curves) {
    if (!c.rating) continue;
    rated++;
    const g = (byGrade[c.grade] ??= { total: 0, ok: 0, tooMild: 0, tooHard: 0, notThere: 0 });
    g.total++;
    g[c.rating]++;
  }
  const hints: RatingSummary['hints'] = [];
  for (const [grade, g] of Object.entries(byGrade)) {
    if (g.total < HINT_MIN_RATINGS) continue;
    for (const kind of ['tooMild', 'tooHard', 'notThere'] as const) {
      const share = g[kind] / g.total;
      if (share >= HINT_MIN_SHARE) hints.push({ grade: Number(grade), kind, share });
    }
  }
  hints.sort((a, b) => a.grade - b.grade);
  return { rated, byGrade, hints };
}

const xml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Aufgezeichnete Fahrt als GPX; Markierungen und Bewertungen stehen als Wegpunkte darin. */
export function recordingToGpx(rec: FreerideRecording, marks: FeedbackMark[] = [], name = 'cornerGuider ride'): string {
  const pts = rec.fixes
    .map((f) => `      <trkpt lat="${f.lat.toFixed(6)}" lon="${f.lon.toFixed(6)}"><time>${new Date(f.t).toISOString()}</time></trkpt>`)
    .join('\n');
  const wpts = marks
    .map(
      (m) =>
        `  <wpt lat="${m.lat.toFixed(6)}" lon="${m.lon.toFixed(6)}"><time>${new Date(m.t).toISOString()}</time>` +
        `<name>${xml(m.kind)}</name>` +
        (m.curve ? `<desc>${xml(`${m.curve.direction} ${m.curve.grade}`)}</desc>` : '') +
        `</wpt>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="cornerGuider" xmlns="http://www.topografix.com/GPX/1/1">\n${wpts}\n  <trk>\n    <name>${xml(name)}</name>\n    <trkseg>\n${pts}\n    </trkseg>\n  </trk>\n</gpx>\n`;
}

/** Alles für den Export (JSON): Aufzeichnung samt Bewertungen und Markierungen der Fahrt. */
export function exportBundle(rec: FreerideRecording, marks: FeedbackMark[]) {
  const mine = marks.filter((m) => m.t >= rec.startedAt && m.t <= rec.endedAt + 60_000);
  return { app: 'cornerGuider', kind: 'ride-feedback', version: 1, recording: rec, marks: mine };
}

/** Markierung an der aktuellen Position und zur aktuellen Kurve anlegen. */
export function buildMark(
  kind: MarkKind,
  source: FeedbackMark['source'],
  fix: { lat: number; lon: number },
  extras: { curve?: FeedbackMark['curve']; routeId?: string; distAlongM?: number } = {},
  now: number = Date.now(),
): FeedbackMark {
  return {
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    t: now,
    lat: fix.lat,
    lon: fix.lon,
    kind,
    source,
    ...extras,
  };
}
