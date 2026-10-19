import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { calibrate, formatCalibration } from '../../src/freeride/calibration';
import { RECORDING_SCHEMA_VERSION, type FreerideRecording } from '../../src/freeride/recordingFormat';
import { makeProjection } from '../../src/geo/projection';
import { calcLeanDeg } from '../../src/tracking/leanAngle';
import { TrackBuilder } from '../curves/helpers';

const origin = { lat: 47, lon: 11 };
const proj = makeProjection(origin);

/** Fahrt mit einer angesagten Linkskurve (R=40), einer Falschmeldung und einer nicht angesagten Rechtskurve (R=25). */
function synthetic(): FreerideRecording {
  const t = new TrackBuilder().straight(150).arc('left', 40, 90).straight(150).arc('right', 25, 90).straight(120);
  const raw = t.xy();
  const pts = raw.filter((_, i) => i % 12 === 0);
  const arcStart = raw[150]!;
  const firstArcEnd = 150 + 63;
  const fixes = pts.map((p, i) => {
    const rawIdx = i * 12;
    const inFirstArc = rawIdx >= 150 && rawIdx <= firstArcEnd + 12;
    return {
      t: 1000 * (i + 1),
      ...proj.toLatLon(p),
      speed: 12,
      accuracy: 5,
      heading: null,
      radiusM: null,
      leanCalcDeg: null,
      gravity: null,
      tiltDeg: inFirstArc ? 20 : 0,
    };
  });
  return {
    schemaVersion: RECORDING_SCHEMA_VERSION,
    id: 'synthetic-1',
    startedAt: 1000,
    endedAt: 1000 * (fixes.length + 1),
    origin,
    fixes,
    announcements: [
      { t: 5000, text: 'x', curves: [{ start: arcStart, grade: 3, direction: 'left', minRadius: 45, shape: 'constant', confidence: 0.9 }] },
      { t: 3000, text: 'y', curves: [{ start: raw[60]!, grade: 2, direction: 'right', minRadius: 25, shape: 'tightening', confidence: 0.8 }] },
    ],
    stats: { steps: fixes.length, ok: fixes.length, uncertain: 0, noRoad: 0, loading: 0, endReasons: {} },
    lean: { sensor: true, zero: [0, 0, -1], zeroAt: 1000 },
  };
}

describe('calibrate', () => {
  const rec = synthetic();
  const { rows, summary } = calibrate(rec);

  it('ordnet die angesagte Kurve der gefahrenen zu und ergänzt Falschmeldung und verpasste Kurve', () => {
    expect(rows.map((r) => `${r.direction}:${r.predicted ? 'P' : '-'}${r.driven ? 'D' : '-'}`)).toEqual([
      'right:P-', // Falschmeldung auf der Geraden
      'left:PD', // angesagt und gefahren
      'right:-D', // gefahren, nicht angesagt
    ]);
    expect(summary).toMatchObject({ matched: 1, predictedOnly: 1, drivenOnly: 1 });
    expect(rows.map((r) => r.pos)).toEqual([...rows.map((r) => r.pos)].sort((a, b) => a - b));
  });

  it('Werte der zugeordneten Kurve: Stufe, Radius, Geschwindigkeit, gemessene und rechnerische Schräglage', () => {
    const m = rows.find((r) => r.predicted && r.driven)!;
    expect(m.predicted).toMatchObject({ grade: 3, minRadius: 45, shape: 'constant' });
    expect(m.driven!.minRadius).toBeGreaterThan(30);
    expect(m.driven!.minRadius).toBeLessThan(60);
    expect(m.driven!.avgSpeedMs).toBeCloseTo(12, 5);
    expect(m.driven!.maxTiltDeg).toBe(20);
    expect(m.driven!.calcLeanDeg).toBeCloseTo(calcLeanDeg(12, m.driven!.minRadius), 5);
    expect(m.driven!.calcLeanDeg).toBeGreaterThan(15);
    expect(m.driven!.calcLeanDeg).toBeLessThan(40);
  });

  it('ohne Sensor bleibt die gemessene Schräglage leer, die rechnerische steht trotzdem da', () => {
    const noSensor = {
      ...rec,
      fixes: rec.fixes.map((f) => ({ ...f, tiltDeg: null })),
      lean: { sensor: false, zero: null, zeroAt: null },
    };
    const res = calibrate(noSensor);
    const m = res.rows.find((r) => r.predicted && r.driven)!;
    expect(m.driven!.maxTiltDeg).toBeNull();
    expect(m.driven!.calcLeanDeg).toBeGreaterThan(0);
    expect(res.summary.fixesWithTilt).toBe(0);
    expect(formatCalibration(res)).toContain('nur rechnerisch');
  });

  it('formatCalibration gibt eine Tabelle mit allen Zeilen aus', () => {
    const text = formatCalibration({ rows, summary });
    expect(text).toContain('Stufe');
    expect(text).toContain('Schräglage');
    expect(text.split('\n').filter((l) => /^\s*\d+\s/.test(l))).toHaveLength(3);
  });

  it('eine Aufzeichnung ohne Kurven ergibt eine leere Tabelle ohne Fehler', () => {
    const flat = new TrackBuilder().straight(400).xy().filter((_, i) => i % 12 === 0);
    const empty: FreerideRecording = {
      ...rec,
      fixes: flat.map((p, i) => ({ ...rec.fixes[0]!, ...proj.toLatLon(p), t: 1000 * (i + 1) })),
      announcements: [],
    };
    expect(calibrate(empty).rows).toEqual([]);
  });
});

describe('npm run calibrate (CLI)', () => {
  it('liest eine Aufzeichnungsdatei und gibt die Tabelle aus', () => {
    const dir = mkdtempSync(join(tmpdir(), 'calibrate-'));
    const file = join(dir, 'ride.json');
    writeFileSync(file, JSON.stringify(synthetic()));
    const out = execFileSync('npx', ['tsx', join(__dirname, '../../scripts/calibrate-cli.ts'), file], { encoding: 'utf8', cwd: join(__dirname, '../..') });
    expect(out).toContain('synthetic-1');
    expect(out).toContain('Schräglage');
    expect(readFileSync(file, 'utf8')).toContain('schemaVersion');
  }, 60_000);

  it('ohne Datei: Hinweis und Fehlercode', () => {
    expect(() =>
      execFileSync('npx', ['tsx', join(__dirname, '../../scripts/calibrate-cli.ts')], { encoding: 'utf8', cwd: join(__dirname, '../..'), stdio: 'pipe' }),
    ).toThrow();
  }, 60_000);
});
