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

  // --- Konfidenz (alle Werte geschätzt, nicht an echten Fahrten kalibriert) ---
  /** Größter Abstand der Original-Knoten im Kurvenbereich, bis zu dem die Geometrie als fein gilt (m) */
  goodNodeSpacingM: number;
  /** Ab diesem Knotenabstand (m) ist die Geometrie zu grob für eine verlässliche Stufe (Konfidenz 0) */
  poorNodeSpacingM: number;
  /** Unter dieser Konfidenz wird keine Stufe angesagt, sondern „Kurve, unsicher" */
  uncertainBelow: number;
  /** GPS-Genauigkeit (m), bis zu der die Position als gut gilt */
  gpsGoodAccuracyM: number;
  /** GPS-Genauigkeit (m), ab der der Faktor `gpsMinFactor` gilt */
  gpsPoorAccuracyM: number;
  /** Kleinster Konfidenzfaktor bei schlechtem GPS */
  gpsMinFactor: number;
  /** Freie Fahrt: Kurven so nah vor einem Pfadende an einer unklaren Kreuzung (m) sind unsicherer */
  junctionProximityM: number;
  /** Konfidenzfaktor für Kurven nahe einer unklaren Kreuzung */
  junctionConfidenceFactor: number;
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
  // Konfidenz: Schätzwerte. Die Kreisnäherung über 15 m Spannweite (radiusSpanM) trägt nur, wenn die
  // Originalknoten deutlich dichter liegen; ab ~80 m Abstand sind es praktisch Sehnen.
  goodNodeSpacingM: 20,
  poorNodeSpacingM: 80,
  uncertainBelow: 0.4,
  gpsGoodAccuracyM: 15,
  gpsPoorAccuracyM: 50,
  gpsMinFactor: 0.3,
  junctionProximityM: 100,
  junctionConfidenceFactor: 0.5,
};
