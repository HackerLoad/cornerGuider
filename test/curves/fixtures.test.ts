import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectCurves } from '../../src/curves';
import { parseGpx } from '../../src/gpx/parseGpx';

function load(name: string) {
  const gpx = parseGpx(readFileSync(join(__dirname, '../fixtures', name), 'utf8'));
  return detectCurves(gpx.points);
}

describe.each(['stelvio.gpx', 'amalfi-coast.gpx'])('echte GPX: %s', (file) => {
  const res = load(file);

  it('erkennt viele Kurven, sortiert und ohne Überlappung gleicher Richtung', () => {
    expect(res.curves.length).toBeGreaterThan(50);
    for (let i = 1; i < res.curves.length; i++) {
      expect(res.curves[i]!.startDist).toBeGreaterThanOrEqual(res.curves[i - 1]!.startDist);
    }
  });

  it('alle Kennwerte sind plausibel', () => {
    for (const c of res.curves) {
      expect(c.grade).toBeGreaterThanOrEqual(1);
      expect(c.grade).toBeLessThanOrEqual(6);
      expect(c.minRadius).toBeGreaterThan(2);
      expect(c.minRadius).toBeLessThan(400);
      expect(c.endDist).toBeLessThanOrEqual(res.length + 1e-6);
      expect(c.geometry.length).toBeGreaterThan(2);
    }
  });
});

it('Stelvio enthält viele Spitzkehren (Stufe 1)', () => {
  expect(load('stelvio.gpx').curves.filter((c) => c.grade === 1).length).toBeGreaterThan(20);
});
