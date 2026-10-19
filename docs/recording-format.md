# Aufzeichnungsformat der Freien Fahrt

Jede Freie Fahrt wird als JSON auf dem Gerät gespeichert (`Dokumente/freeride/<id>.json`). Das Format ist versioniert (`schemaVersion`). Die Typen stehen in `src/freeride/recordingFormat.ts`, gelesen wird mit `parseRecording`. Es liest Format 1 (alt, Feld `version: 1`) und Format 2 und liefert immer Format 2. Eine unbekannte neuere Version wird abgelehnt.

Die App ändert anhand der Aufzeichnung **keine** Schwellwerte. Sie ist die Grundlage, um sie später von Hand zu kalibrieren (`npm run calibrate`).

## Auswertung

```
npm run calibrate -- aufzeichnung.json
```

Die Datei ist entweder eine Aufzeichnung oder das JSON-Exportpaket (`kind: "ride-feedback"`) aus der Ergebnisansicht der Freien Fahrt. Das Skript berechnet aus der gefahrenen Spur die tatsächlichen Kurven, ordnet jede angesagte Kurve der gefahrenen zu (gleiche Richtung, Kurvenanfänge höchstens 40 m auseinander) und gibt je Kurve eine Zeile aus:

| Spalte | Bedeutung |
| --- | --- |
| Pos | Strecke entlang der gefahrenen Spur (m) |
| vorh. Stufe / R / Form / conf | was die App vorhergesagt und angesagt hat (Stufe, Mindestradius, zieht zu/öffnet, Konfidenz) |
| gef. Stufe / R / Form | was die gefahrene Spur tatsächlich ergibt |
| Ø v | mittlere GPS-Geschwindigkeit in der Kurve (km/h) |
| Schräglage gem. | größte gemessene Neigung gegenüber dem Nullpunkt in der Kurve (°); `–` ohne Sensorwerte |
| rechn. | rechnerische Schräglage `atan(v² / (r · g))` aus Ø v und gefahrenem Mindestradius (°) |

Zeilen ohne vorhergesagte Seite sind Kurven bis Stufe 4, die die App nicht angesagt hat. Zeilen ohne gefahrene Seite sind Ansagen ohne passende gefahrene Kurve (Falschmeldung oder abgebogen).

## Felder (Format 2)

| Feld | Typ | Bedeutung |
| --- | --- | --- |
| `schemaVersion` | `2` | Formatversion |
| `id` | string | Kennung; enthält den Startzeitpunkt (base36) |
| `startedAt`, `endedAt` | ms (epoch) | Beginn und Ende der Fahrt |
| `origin` | `{lat, lon}` | Ursprung der lokalen Meter (= erste Position), Bezug für `announcements[].curves[].start` |
| `fixes` | Liste | ein Eintrag je Positionsmeldung (ca. 1 Hz), siehe unten |
| `announcements` | Liste | `{t, text, curves[]}`; `curves[]` sind die genannten Kurven |
| `stats` | Objekt | Zähler der Fahrt (`steps`, `ok`, `uncertain`, `noRoad`, `loading`, `endReasons`) |
| `lean` | Objekt | `{sensor, zero, zeroAt}`, siehe unten |
| `ratings` | Objekt, optional | Bewertungen der Ansagen nach der Fahrt (`tooMild`, `tooHard`, `notThere`, `ok`) |

### `fixes[]`

| Feld | Einheit | Bedeutung |
| --- | --- | --- |
| `t` | ms | Zeitpunkt |
| `lat`, `lon` | Grad | Position |
| `speed` | m/s | GPS-Geschwindigkeit, `null` wenn unbekannt |
| `accuracy` | m | GPS-Genauigkeit, `null` wenn unbekannt |
| `heading` | Grad | Fahrtrichtung laut GPS, `null` wenn nicht geliefert |
| `radiusM` | m | Radius der gefahrenen Kurve aus den letzten Positionen (Umkreis durch drei Punkte, mindestens 8 m auseinander); `null` bei Gerade oder Stand. Gilt für den mittleren der drei Punkte, hinkt also hinterher |
| `leanCalcDeg` | Grad | rechnerische Schräglage `atan(v² / (r · g))` aus `speed` und `radiusM`; 0 bei Gerade; `null` ohne Geschwindigkeit. Rückfallgröße, wenn der Sensorwert unbrauchbar ist |
| `gravity` | `[x,y,z]` | geglättete Schwerkraftrichtung im Koordinatensystem des Handys (normiert, 3 Nachkommastellen); `null` ohne Sensor |
| `tiltDeg` | Grad | Winkel zwischen `gravity` und dem Nullpunkt `lean.zero` (≥ 0, ohne Vorzeichen); `null` ohne Sensor oder ohne Nullpunkt |

### Schräglage und Halterung

Die Halterung am Lenker ist beliebig ausgerichtet. Deshalb wird kein fester Rollwinkel angenommen:

1. **Nullpunkt:** Steht das Motorrad (Geschwindigkeit < 1 m/s), mittelt die App drei Messungen der Schwerkraftrichtung. Das ergibt `lean.zero` (aufrechtes Motorrad). Gelingt das nicht beim Start, wird es beim ersten späteren Halt nachgeholt (`lean.zeroAt` zeigt wann). Danach ändert sich der Nullpunkt nicht mehr.
2. **Neigung:** `tiltDeg` ist der Winkel zwischen der aktuellen Schwerkraftrichtung und `lean.zero`. Das ist unabhängig davon, wie das Handy sitzt, aber ohne Vorzeichen. Die Seite (links/rechts) ergibt sich aus der Kurvenrichtung der gefahrenen Spur.
3. **Rückfall:** `leanCalcDeg` bzw. die Spalte „rechn." gibt es immer, auch ohne Sensor.

Grenzen: Die Neigung wird aus der Schwerkraftrichtung des Handys geschätzt. In Kurven wirkt zusätzlich die Fliehkraft, und Vibrationen stören. Wie gut das auf dem Motorrad zusammenpasst, ist **nicht geprüft**. Ob der Sensor bei gesperrtem Display im Hintergrund weiterliefert, ist ebenfalls **nicht geprüft**.

### `lean`

| Feld | Bedeutung |
| --- | --- |
| `sensor` | beim Start war ein Bewegungssensor verfügbar |
| `zero` | Schwerkraftrichtung im Stand (`[x,y,z]`) oder `null` |
| `zeroAt` | Zeitpunkt der Aufnahme des Nullpunkts (ms) oder `null` |

### `announcements[].curves[]`

| Feld | Bedeutung |
| --- | --- |
| `start` | Anfang der Kurve in lokalen Metern um `origin` |
| `grade`, `direction` | angesagte Stufe (1–6) und Richtung |
| `minRadius` | vorhergesagter Mindestradius (m), `null` in Format 1 |
| `shape` | `tightening`, `opening` oder `constant`, `null` in Format 1 |
| `confidence` | Konfidenz der Vorhersage (0–1), `null` in Format 1 |

## Änderungen gegenüber Format 1

- `version: 1` heißt jetzt `schemaVersion: 2`.
- Neu je Messpunkt: `accuracy`, `heading`, `radiusM`, `leanCalcDeg`, `gravity`, `tiltDeg`.
- Neu je angesagter Kurve: `minRadius`, `shape`, `confidence`.
- Neu: `lean`.
- Alte Dateien bleiben lesbar; die neuen Felder sind dann `null`.

## Datenschutz

Aufzeichnungen entstehen nur auf dem Gerät und verlassen es nicht automatisch. Ein Export (GPX oder JSON) geschieht nur, wenn die Person ihn in der Ergebnisansicht selbst auslöst. Die Aufzeichnung enthält die gefahrene Spur mit Zeitstempeln und gehört damit zu den personenbezogenen Daten; die Datenschutzerklärung (Entwurf) in `docs/release/privacy-policy-draft.md` beschreibt das. Auf Android wird der JSON-Export als Text geteilt; sehr lange Fahrten können dabei an die Größengrenze des Teilen-Dialogs stoßen (nicht geprüft).
