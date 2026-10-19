import { RECORDING_SCHEMA_VERSION, parseRecording } from '../../src/freeride/recordingFormat';

const v1 = {
  version: 1,
  id: 'abc-1',
  startedAt: 1000,
  endedAt: 20000,
  origin: { lat: 40.6, lon: 14.5 },
  fixes: [{ t: 1000, lat: 40.6, lon: 14.5, speed: 10 }, { t: 2000, lat: 40.6001, lon: 14.5001, speed: null }],
  announcements: [{ t: 1500, text: 'x', curves: [{ start: { x: 1, y: 2 }, grade: 3, direction: 'left' }] }],
  stats: { steps: 2, ok: 2, uncertain: 0, noRoad: 0, loading: 0, endReasons: {} },
};

describe('parseRecording', () => {
  it('Version 1 wird auf das aktuelle Schema gehoben, fehlende Messwerte sind null', () => {
    const r = parseRecording(v1)!;
    expect(r.schemaVersion).toBe(RECORDING_SCHEMA_VERSION);
    expect(r.fixes[0]).toMatchObject({ t: 1000, speed: 10, accuracy: null, heading: null, radiusM: null, leanCalcDeg: null, gravity: null, tiltDeg: null });
    expect(r.announcements[0]!.curves[0]).toMatchObject({ grade: 3, minRadius: null, shape: null, confidence: null });
    expect(r.lean).toEqual({ sensor: false, zero: null, zeroAt: null });
  });

  it('Version 2 bleibt unverändert', () => {
    const v2 = parseRecording(v1)!;
    expect(parseRecording(JSON.parse(JSON.stringify(v2)))).toEqual(v2);
  });

  it('nimmt auch das Export-Paket (ride-feedback) an', () => {
    const r = parseRecording({ app: 'cornerGuider', kind: 'ride-feedback', version: 1, recording: v1, marks: [] })!;
    expect(r.id).toBe('abc-1');
  });

  it('lehnt Unbrauchbares ab', () => {
    expect(parseRecording(null)).toBeNull();
    expect(parseRecording({})).toBeNull();
    expect(parseRecording({ ...v1, version: 99 })).toBeNull();
    expect(parseRecording({ ...v1, fixes: 'x' })).toBeNull();
    expect(parseRecording({ schemaVersion: 3, ...v1 })).toBeNull(); // unbekannte neuere Version
  });
});
