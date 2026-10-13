/** Alle Schwellwerte der Kurvenerkennung an einer Stelle. */
export interface CurveConfig {
  /** Abstand der resampelten Punkte (m) */
  resampleStepM: number;
  /** Glättung: gleitender Mittelwert ±n Punkte */
  smoothHalfWindow: number;
  /** Abstand der Stützpunkte für den Umkreisradius (m) */
  radiusSpanM: number;
  /** Radius, unter dem ein Punkt als "in der Kurve" gilt (m) */
  maxCurveRadiusM: number;
  /** Lücken gleicher Richtung bis zu dieser Länge werden zusammengeführt (m) */
  mergeGapM: number;
  /** Kurven mit kleinerem Gesamtwinkel werden verworfen (Grad) */
  minTotalAngleDeg: number;
  /** Kurven kürzer als dies werden verworfen (m) */
  minLengthM: number;
  /** Kurven mit kleinerem Abstand gelten als Folge (m) */
  sequenceGapM: number;
  /** Vor-/Nachlauf der Kurvengeometrie für die Grafik (m) */
  geometryMarginM: number;
  /** Anteil des Kurvenrandes für Zu-/Aufgehen-Vergleich (Anfang/Ende) */
  shapeFraction: number;
  /** Relative Krümmungsänderung ab der eine Kurve zugeht/aufgeht */
  shapeRatio: number;
  /** Sicherheitsfaktor auf den Radius vor der Einstufung (<1 = enger einstufen) */
  radiusSafetyFactor: number;
  /** Obergrenzen des Mindestradius (m) für Stufe 1..5; darüber Stufe 6 */
  gradeMaxRadiusM: [number, number, number, number, number];
}

export const DEFAULT_CURVE_CONFIG: CurveConfig = {
  resampleStepM: 5,
  smoothHalfWindow: 1,
  radiusSpanM: 15,
  maxCurveRadiusM: 400,
  mergeGapM: 30,
  minTotalAngleDeg: 15,
  minLengthM: 10,
  sequenceGapM: 50,
  geometryMarginM: 50,
  shapeFraction: 0.33,
  shapeRatio: 1.25,
  radiusSafetyFactor: 0.9,
  // Stufe 1 = Spitzkehre … 6 = sehr leicht
  gradeMaxRadiusM: [15, 30, 50, 80, 130],
};
