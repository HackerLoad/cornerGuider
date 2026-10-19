import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectCurves } from '../../src/curves';
import { DEFAULT_CURVE_CONFIG } from '../../src/curves/config';
import { isUncertain } from '../../src/curves/confidence';
import { parseGpx } from '../../src/gpx/parseGpx';
import { simulate } from '../freeride/fixtureSim';

/**
 * Festgehaltene Messwerte auf Stelvio und Amalfi. Der Test ist KEIN Gütesiegel: Er macht nur sichtbar, wenn
 * eine Änderung an Schwellwerten oder Erkennung die Zahlen verschiebt. Bei bewusster Änderung die Werte hier
 * UND in der Tabelle „Messwerte" im README ehrlich nachziehen (auch Verschlechterungen).
 */
const fx = (n: string) => readFileSync(join(__dirname, '../fixtures', n), 'utf8');
const stats = (gpx: string) => {
  const { curves } = detectCurves(parseGpx(fx(gpx)).points);
  return {
    count: curves.length,
    grades: [1, 2, 3, 4, 5, 6].map((g) => curves.filter((c) => c.grade === g).length),
    uncertain: curves.filter((c) => isUncertain(c.confidence, DEFAULT_CURVE_CONFIG)).length,
  };
};

describe('Regression: erkannte Kurven und Stufenverteilung (nur GPX)', () => {
  it('Stelvio', () => {
    expect(stats('stelvio.gpx')).toEqual({ count: 235, grades: [76, 35, 62, 44, 17, 1], uncertain: 26 });
  });
  it('Amalfi', () => {
    expect(stats('amalfi-coast.gpx')).toEqual({ count: 358, grades: [60, 153, 102, 39, 3, 1], uncertain: 11 });
  });
});

describe('Regression: Freie Fahrt (Simulation mit OSM-Daten)', () => {
  it('Stelvio: 33 von 39 Ansagen richtig, 26 von 37 Kurven bis Stufe 4 erkannt', () => {
    const { res } = simulate('stelvio.gpx', 'osm-stelvio.json', 450);
    expect([res.announced, res.correct, res.actual, res.recalled]).toEqual([39, 33, 37, 26]);
  });
  it('Amalfi: 76 von 77 Ansagen richtig, 72 von 74 Kurven bis Stufe 4 erkannt', () => {
    const { res } = simulate('amalfi-coast.gpx', 'osm-amalfi.json', 700);
    expect([res.announced, res.correct, res.actual, res.recalled]).toEqual([77, 76, 74, 72]);
  });
});
