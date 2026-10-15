import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildStoredRoute, summarize } from '../../src/routes/model';
import { formatDistance, formatKm } from '../../src/format';

const fixture = (n: string) => readFileSync(join(__dirname, '../fixtures', n), 'utf8');

describe('buildStoredRoute', () => {
  it('baut eine serialisierbare Route aus echtem GPX', () => {
    const r = buildStoredRoute(fixture('stelvio.gpx'), 'x', 1700000000000);
    expect(r.name).toContain('Stelvio');
    expect(r.curves.length).toBeGreaterThan(100);
    expect(r.warnings).toHaveLength(0);
    const roundtrip = JSON.parse(JSON.stringify(r));
    expect(roundtrip.curves[0].geometry.length).toBe(r.curves[0]!.geometry.length);
    expect(summarize(r).curveCount).toBe(r.curves.length);
    expect(JSON.stringify(r).length).toBeLessThan(2_000_000);
  });

  it('warnt bei spärlichen Punkten', () => {
    const gpx = `<gpx><rte><name>R</name><rtept lat="47" lon="11"/><rtept lat="47.05" lon="11.05"/><rtept lat="47.1" lon="11"/></rte></gpx>`;
    const r = buildStoredRoute(gpx, 'x');
    expect(r.warnings.some((w) => typeof w !== 'string' && w.code === 'sparse')).toBe(true);
  });

  it('nutzt den Fallback-Namen ohne Namen in der Datei', () => {
    const gpx = `<gpx><trk><trkseg><trkpt lat="47" lon="11"/><trkpt lat="47.001" lon="11"/></trkseg></trk></gpx>`;
    expect(buildStoredRoute(gpx, 'Datei').name).toBe('Datei');
  });
});

describe('format', () => {
  it('Distanzen', () => {
    expect(formatDistance(240)).toBe('240 m');
    expect(formatDistance(1500)).toBe('1,5 km');
    expect(formatKm(29700)).toBe('29,7 km');
  });
});
