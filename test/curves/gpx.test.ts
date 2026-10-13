import { parseGpx } from '../../src/gpx/parseGpx';

describe('parseGpx', () => {
  it('liest Track', () => {
    const g = parseGpx(`<gpx><trk><name>T</name><trkseg><trkpt lat="1" lon="2"/><trkpt lat="1.1" lon="2.1"/></trkseg></trk></gpx>`);
    expect(g.kind).toBe('track');
    expect(g.name).toBe('T');
    expect(g.points).toHaveLength(2);
  });
  it('liest Route', () => {
    const g = parseGpx(`<gpx><rte><rtept lat="1" lon="2"/><rtept lat="1.1" lon="2.1"/></rte></gpx>`);
    expect(g.kind).toBe('route');
  });
  it('wirft bei leerer Datei', () => {
    expect(() => parseGpx('<gpx></gpx>')).toThrow();
  });
});
