import type { XY } from '../geo/types';

export type Direction = 'left' | 'right';
export type Shape = 'tightening' | 'opening' | 'constant';
/** Rallye-Skala: 1 = Spitzkehre … 6 = sehr leicht */
export type Grade = 1 | 2 | 3 | 4 | 5 | 6;

export interface Curve {
  index: number;
  /** Beginn der Kurve entlang der Route (m) */
  startDist: number;
  endDist: number;
  length: number;
  /** Kleinster Radius (m), geglättet */
  minRadius: number;
  /** Gesamte Richtungsänderung (Grad, ≥ 0) */
  totalAngle: number;
  direction: Direction;
  shape: Shape;
  /** Angesagte/angezeigte Stufe: `measuredGrade`, bei niedriger Konfidenz um eins enger */
  grade: Grade;
  /** Stufe allein aus dem Radius (mit Sicherheitsabschlag), ohne Abzug für unsichere Geometrie */
  measuredGrade: Grade;
  /**
   * Verlässlichkeit der Stufe (0–1). Sinkt bei grober Geometrie (große Abstände der Original-Knoten),
   * in der Freien Fahrt zusätzlich nahe unklaren Kreuzungen und bei schlechtem GPS.
   */
  confidence: number;
  /** Anfang und Ende der Kurve in den lokalen Metern der Eingabe (für Vergleiche und Wiedererkennung) */
  startXY: XY;
  endXY: XY;
  /** Folgt in < sequenceGapM auf die vorherige Kurve */
  followsPrevious: boolean;
  /** Abstand zur vorherigen Kurve (m), null bei der ersten */
  gapToPrevious: number | null;
  /**
   * Geometrie inkl. Vor-/Nachlauf, im Kurvensystem:
   * Ursprung = Kurvenanfang, Einfahrtsrichtung = +y.
   */
  geometry: XY[];
  /** Indizes in `geometry`, an denen die Kurve beginnt/endet */
  geometryCurveStart: number;
  geometryCurveEnd: number;
}

export interface DetectionResult {
  curves: Curve[];
  /** Gesamtlänge der Route (m) */
  length: number;
  /** Resampelte Route in lokalen Metern (Abstand ≈ resampleStepM, Index i ↔ dist[i]) */
  path: XY[];
  dist: number[];
  projectionOrigin: { lat: number; lon: number };
}
