import { matchPosition } from '../../src/freeride/mapMatch';
import { predictPath } from '../../src/freeride/predictPath';
import { graphOf, way } from './net';

const match = (g: ReturnType<typeof graphOf>, x: number, y: number, heading: number | null) =>
  matchPosition(g, { x, y }, heading, null)!;

describe('matchPosition', () => {
  const g = graphOf([way(1, [1, 2], [[0, 0], [0, 500]])]);

  it('ordnet Position und Fahrtrichtung zu', () => {
    const north = match(g, 5, 100, 0);
    expect(north.forward).toBe(true);
    expect(north.lateral).toBeCloseTo(5, 3);
    expect(north.s).toBeCloseTo(100, 3);
    expect(match(g, 5, 100, 180).forward).toBe(false);
  });

  it('findet nichts außerhalb des Suchradius und bei quer liegender Fahrtrichtung', () => {
    expect(matchPosition(g, { x: 80, y: 100 }, 0, null)).toBeNull();
    expect(matchPosition(g, { x: 3, y: 100 }, 90, null)).toBeNull();
  });

  it('parallele Straßen dicht beieinander sind nicht sicher zugeordnet', () => {
    const p = graphOf([way(1, [1, 2], [[0, 0], [0, 500]]), way(2, [3, 4], [[12, 0], [12, 500]])]);
    expect(match(p, 6, 100, 0).confident).toBe(false);
    expect(match(p, 1, 100, 0).confident).toBe(true);
  });

  it('bevorzugt die bisherige Straße (Hysterese)', () => {
    const p = graphOf([way(1, [1, 2], [[0, 0], [0, 500]]), way(2, [3, 4], [[8, 0], [8, 500]])]);
    const first = matchPosition(p, { x: 1, y: 100 }, 0, null)!;
    const second = matchPosition(p, { x: 4.5, y: 120 }, 0, first)!;
    expect(second.wayId).toBe(first.wayId);
  });

  it('Einbahnstraße gegen die Richtung wird gemieden', () => {
    const p = graphOf([
      way(1, [1, 2], [[0, 0], [0, 500]], { oneway: 'yes' }),
      way(2, [3, 4], [[10, 0], [10, 500]]),
    ]);
    // Fahrt nach Süden (180°) zwischen beiden: die Einbahn (nach Norden) darf nicht gewinnen
    expect(matchPosition(p, { x: 4, y: 100 }, 180, null)!.wayId).toBe(2);
  });
});

describe('predictPath', () => {
  it('folgt der Straße über einen Wechsel auf die nächste Straße ohne Kreuzung', () => {
    const g = graphOf([
      way(1, [1, 2, 3], [[0, 0], [0, 300], [0, 600]]),
      way(2, [3, 4], [[0, 600], [0, 1200]]),
    ]);
    const p = predictPath(g, match(g, 0, 100, 0));
    expect(p.endReason).toBe('horizon');
    expect(p.ahead).toBeCloseTo(600, 0);
    expect(p.pts[p.pts.length - 1]!.y).toBeCloseTo(700, 0);
  });

  it('geht an einer Einmündung geradeaus weiter (Seitenstraße im Winkel von 90°)', () => {
    const g = graphOf([
      way(1, [1, 2, 3], [[0, 0], [0, 300], [0, 1000]]),
      way(2, [2, 4], [[0, 300], [200, 300]], { highway: 'residential' }),
    ]);
    const p = predictPath(g, match(g, 0, 100, 0));
    expect(p.endReason).toBe('horizon');
    expect(p.pts[p.pts.length - 1]!.x).toBeCloseTo(0, 1);
  });

  it('hält vor einer Gabelung ohne klare Weiterfahrt an', () => {
    const g = graphOf([
      way(1, [1, 2], [[0, 0], [0, 300]]),
      way(2, [2, 3], [[0, 300], [-100, 400]]),
      way(3, [2, 4], [[0, 300], [100, 400]]),
    ]);
    const p = predictPath(g, match(g, 0, 100, 0));
    expect(p.endReason).toBe('junction');
    expect(p.ahead).toBeCloseTo(200, 0);
  });

  it('bevorzugt bei gleicher Straßennummer die durchgehende Straße an einer Gabelung', () => {
    const g = graphOf([
      way(1, [1, 2], [[0, 0], [0, 300]], { ref: 'SS163' }),
      way(2, [2, 3], [[0, 300], [-60, 400]], { ref: 'SS163' }),
      way(3, [2, 4], [[0, 300], [60, 400]], { ref: 'SP1' }),
    ]);
    expect(predictPath(g, match(g, 0, 100, 0)).endReason).not.toBe('junction');
  });

  it('endet an Kreisverkehr und am Datenende', () => {
    const rb = graphOf([
      way(1, [1, 2], [[0, 0], [0, 300]]),
      way(2, [2, 3, 4, 2], [[0, 300], [30, 330], [0, 360], [0, 300]], { junction: 'roundabout' }),
    ]);
    expect(predictPath(rb, match(rb, 0, 100, 0)).endReason).toBe('roundabout');
    const end = graphOf([way(1, [1, 2], [[0, 0], [0, 250]])]);
    const p = predictPath(end, match(end, 0, 100, 0));
    expect(p.endReason).toBe('dataEnd');
    expect(p.ahead).toBeCloseTo(150, 0);
  });

  it('nimmt ein Stück Straße hinter der Position mit und gibt die Position darin an', () => {
    const g = graphOf([way(1, [1, 2], [[0, 0], [0, 1000]])]);
    const p = predictPath(g, match(g, 0, 300, 0));
    expect(p.positionDist).toBeCloseTo(80, 0);
    expect(p.pts[0]!.y).toBeCloseTo(220, 0);
    const south = predictPath(g, match(g, 0, 300, 180));
    expect(south.pts[south.pts.length - 1]!.y).toBeCloseTo(0, 0); // läuft nach Süden, nur 300 m Straße
    expect(south.endReason).toBe('dataEnd');
  });

  it('beachtet Einbahnstraßen an Kreuzungen', () => {
    const g = graphOf([
      way(1, [1, 2], [[0, 0], [0, 300]]),
      way(2, [2, 3], [[0, 300], [-100, 400]], { oneway: '-1' }), // nur zur Kreuzung hin befahrbar
      way(3, [2, 4], [[0, 300], [100, 400]]),
    ]);
    // Weg 2 darf nicht von der Kreuzung weg befahren werden → eindeutig nach rechts
    const p = predictPath(g, match(g, 0, 100, 0));
    expect(p.endReason).not.toBe('junction');
    expect(p.pts[p.pts.length - 1]!.x).toBeGreaterThan(50);
  });
});
