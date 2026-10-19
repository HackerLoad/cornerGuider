import { HINT_MIN_RATINGS, curveKey, distanceAtTime, exportBundle, ratedCurves, recordingToGpx, summarizeRatings, type FeedbackMark } from '../src/feedback/model';
import { parseRecording } from '../src/freeride/recordingFormat';
import type { FreerideRecording } from '../src/freeride/session';
import { makeProjection } from '../src/geo/projection';

const origin = { lat: 47, lon: 11 };
const proj = makeProjection(origin);
const fix = (t: number, y: number) => ({ t, ...proj.toLatLon({ x: 0, y }), speed: 15 });

// Gespeichert im alten Format 1; parseRecording hebt es auf das aktuelle Schema
const rec: FreerideRecording = parseRecording({
  version: 1,
  id: 'x',
  startedAt: 1000,
  endedAt: 5000,
  origin,
  fixes: [fix(1000, 0), fix(2000, 100), fix(3000, 200), fix(4000, 300), fix(5000, 400)],
  announcements: [
    { t: 2500, text: 'a', curves: [{ start: { x: 0, y: 0 }, grade: 3, direction: 'right' }, { start: { x: 0, y: 0 }, grade: 4, direction: 'left' }] },
    { t: 4200, text: 'b', curves: [{ start: { x: 0, y: 0 }, grade: 2, direction: 'left' }] },
  ],
  stats: { steps: 5, ok: 5, uncertain: 0, noRoad: 0, loading: 0, endReasons: {} },
  ratings: { [curveKey(2500, 1)]: 'tooMild' },
})!;

describe('Bewertungen', () => {
  it('listet angesagte Kurven in Fahrtreihenfolge mit ihrer Bewertung', () => {
    const list = ratedCurves(rec);
    expect(list.map((c) => `${c.direction}${c.grade}`)).toEqual(['right3', 'left4', 'left2']);
    expect(list.map((c) => c.rating)).toEqual([undefined, 'tooMild', undefined]);
    expect(new Set(list.map((c) => c.key)).size).toBe(3);
  });

  it('Fahrtlänge zu einem Zeitpunkt', () => {
    expect(distanceAtTime(rec, 1000)).toBeCloseTo(0, 0);
    expect(distanceAtTime(rec, 2500)).toBeCloseTo(100, 0);
    expect(distanceAtTime(rec, 9999)).toBeCloseTo(400, 0);
  });

  it('Zusammenfassung zählt je Stufe und gibt erst ab genug Bewertungen Hinweise', () => {
    const few = summarizeRatings([{ grade: 3, rating: 'tooMild' }, { grade: 3, rating: 'ok' }, { grade: 4 }]);
    expect(few.rated).toBe(2);
    expect(few.byGrade[3]).toMatchObject({ total: 2, tooMild: 1, ok: 1 });
    expect(few.hints).toEqual([]);

    const many = summarizeRatings([
      ...Array(3).fill({ grade: 4, rating: 'tooMild' }),
      ...Array(2).fill({ grade: 4, rating: 'ok' }),
      ...Array(HINT_MIN_RATINGS).fill({ grade: 2, rating: 'ok' }),
    ]);
    expect(many.hints).toEqual([{ grade: 4, kind: 'tooMild', share: 0.6 }]);
  });
});

describe('Export', () => {
  const marks: FeedbackMark[] = [
    { id: 'm1', t: 3000, ...proj.toLatLon({ x: 0, y: 200 }), kind: 'wrong', source: 'free', curve: { direction: 'right', grade: 3 } },
    { id: 'm2', t: 99999, ...proj.toLatLon({ x: 0, y: 0 }), kind: 'missing', source: 'free' },
  ];

  it('GPX enthält Spur und Markierungen als Wegpunkte und ist gültig maskiert', () => {
    const gpx = recordingToGpx(rec, marks, 'Ride <1> & "test"');
    expect(gpx.match(/<trkpt /g)).toHaveLength(5);
    expect(gpx.match(/<wpt /g)).toHaveLength(2);
    expect(gpx).toContain('<name>wrong</name>');
    expect(gpx).toContain('Ride &lt;1&gt; &amp; &quot;test&quot;');
    expect(gpx).toContain('<desc>right 3</desc>');
  });

  it('Bündel enthält nur Markierungen aus dem Zeitraum der Fahrt', () => {
    const b = exportBundle(rec, marks);
    expect(b.marks.map((m) => m.id)).toEqual(['m1']);
    expect(b.recording.ratings).toBeDefined();
    expect(b.kind).toBe('ride-feedback');
  });
});
