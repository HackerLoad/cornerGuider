# Ergebnis der Review-Runde 2026-10

Auftrag: `docs/review-2026-10.md`. Stand: 19.10.2026. Jede Aufgabe ist ein Commit; vor jedem Commit liefen `npm test` und `npm run typecheck` grün (am Ende 262 Tests, vorher 154).

**Kurz:** Die Aufgaben A1–A8 sind im Code und in der Doku umgesetzt. **Auf einem Gerät, einem Motorrad oder in einem echten Cloud-Build wurde nichts geprüft.** Die Messwerte stammen aus der Simulation entlang von zwei GPX-Strecken. B2 (fehlende Kurven auf Stelvio) ist **nicht** besser geworden.

## 1. Erledigte Aufgaben

| Aufgabe | Commit | Was jetzt gilt |
| --- | --- | --- |
| Vorbereitung | `c2ae9a8` | Auftrag in `docs/`, README-Abschnitt „Nicht geprüft“, Baseline-Messwerte |
| A1 Konfidenz, Unsicherheitssignal (B3, B4) | `efe4330` | `Curve.confidence` aus dem Abstand der Original-Knoten (vor dem Resampling), in der Freien Fahrt auch aus Kreuzungsnähe und GPS-Genauigkeit; unter 0,4 heißt die Ansage „Kurve, unsicher“; „Keine Vorschau“ / „Vorschau wieder da“ je einmal (entprellt, nicht im Stand); unsichere Kurven gestrichelt/grau mit „?“; CLI zeigt die Konfidenz |
| A2 Sicherheitsausrichtung (B2, B4) | `322559f` | `safetyMarginRadiusFactor` 0,9 → 0,85; bei Konfidenz < 0,7 eine Stufe enger (`Curve.measuredGrade` bleibt erhalten); Regressionstests `test/curves/regression.test.ts` |
| A3 „Zieht zu“ / „öffnet“ (B5) | `21eb206` | Auf Basis des vorhandenen `shape` (Entscheidung Max); `shape` berücksichtigt jetzt den engsten Punkt; deutlich zuziehende Kurven (≥ 2×, Stufe ≤ 5) umgehen den Ansagefilter; Grafik markiert sie; CLI zeigt Trend und Faktor |
| A4 Aufzeichnung für die Kalibrierung (B1, B10) | `5d824cd` | Format `schemaVersion: 2` mit GPS-Genauigkeit, gefahrenem Radius, rechnerischer Schräglage `atan(v²/(r·g))`, Schwerkraftrichtung und Neigung gegen einen Nullpunkt im Stand (`expo-sensors`); `npm run calibrate`; `docs/recording-format.md`; Datenschutzentwurf ergänzt |
| A5 Navi-Zusammenspiel (B9) | `74cfe8f` | Schalter „Kurze Ansagen“ (Entscheidung Max: zusätzlicher Schalter); sparsames Orten im Stand auch in der Freien Fahrt; `docs/audio-behavior.md`; `docs/test-protocol-navi.md` (**nicht durchgeführt**) |
| A6 Straßendaten (B6, B7) | `c09f096` | `RoadDataSource` (Overpass, Speicher, Mock für Tests); Server, User-Agent und Anfragen pro Minute aus der Build-Konfiguration; OSM-Namensnennung in Einstellungen › Über und auf den Seiten der Freien Fahrt; `docs/road-data-backend.md` (Planung, Empfehlung); Store-Texte, Website-Briefing, Datenschutzentwurf ergänzt |
| A7 Store-Builds über EAS (B8) | `dfae6e9` | `eas.json` mit `image: latest` und gesperrten öffentlichen Overpass-Servern im Release; Checkliste mit Grundregel und Befehlen (nicht ausgeführt); Live-Aktivität-Prüfung dokumentiert |
| A8 Benachrichtigungsrecht (B11) | `bb97a86` | `POST_NOTIFICATIONS` im Manifest (im generierten Manifest bestätigt); Abfrage vor dem Fahrmodus (nicht in der Simulation); Hinweis bei Ablehnung in beiden Sprachen |

## 2. Messwerte vorher / nachher

Quelle: `npm run curves` und die Freie-Fahrt-Simulation mit echten OSM-Daten (`test/curves/regression.test.ts` hält die Werte fest).

| | Vorher | Nachher |
| --- | --- | --- |
| Stelvio: Kurven / Stufen 1–6 | 235 / 71·20·60·57·24·3 | 235 / 76·35·62·44·17·1 |
| Amalfi: Kurven / Stufen 1–6 | 358 / 34·155·108·51·9·1 | 358 / 60·153·102·39·3·1 |
| Stelvio: Ansagen richtig | 85 % (33/39) | 85 % (33/39) |
| Stelvio: Kurven bis Stufe 4 erkannt | 71 % (24/34) | 70 % (26/37) |
| Amalfi: Ansagen richtig | 99 % (76/77) | 99 % (76/77) |
| Amalfi: Kurven bis Stufe 4 erkannt | 97 % (70/72) | 97 % (72/74) |
| Unsichere Kurven (Konfidenz < 0,4) | – | Stelvio 26 von 235, Amalfi 11 von 358 |
| „Zieht zu“ (davon deutlich) | – | Stelvio 61 (35), Amalfi 104 (65) |

**Einordnung, ungeschönt:**
- Die strengere Einstufung verschiebt viele Kurven in engere Stufen (Spitzkehren auf Amalfi 34 → 60). Das ist gewollt, aber nicht an echten Fahrten geprüft.
- Die **Erkennungsquote auf Stelvio ist nicht besser** (11 von 37 Kurven bis Stufe 4 fehlen weiter). A2 betrifft nur die Richtung des Fehlers, nicht die Ursache. Laut Kommentar in `test/freeride/engine.test.ts` läuft der Track dort teils über Nebenstraßen; die Ursache wurde in dieser Runde nicht untersucht.
- Der Abschlag 0,85 statt 0,9 ist ein Schätzwert aus vier ausprobierten Werten (0,9 / 0,85 / 0,8 / 0,75), nicht kalibriert.
- Die erste Fassung der Form-Erkennung stufte 94 (Stelvio) bzw. 149 (Amalfi) Kurven als „zieht zu“ ein, weil auch Kurven mit dem engsten Punkt in der Mitte dazuzählten. Das ist korrigiert (61 bzw. 104).

## 3. Was weiterhin nicht geprüft ist

(Vollständige Liste: `README.md`, Abschnitt „Nicht geprüft“.)

- **Alles auf einem Gerät:** Fahrt auf einem Motorrad, Android überhaupt (wurde nie gebaut), Ducking der Musik, Bluetooth-Headset, Hintergrund-Ortung, alle neuen Anzeigen (gestrichelte Kurve, „zieht zu“-Markierung, Über-Abschnitt, Schalter „Kurze Ansagen“).
- **Kalibrierung:** Die Schwellwerte sind weiter Schätzwerte (Konfidenz, Sicherheitsabschlag, Form, deutlich zuziehend). Der Bewegungssensor wurde nie gelesen; ob die Neigung aus der Schwerkraftrichtung zur echten Schräglage passt, ist offen.
- **Navi-Zusammenspiel:** `docs/audio-behavior.md` ist aus dem Quellcode gelesen. Das Testprotokoll ist **nicht durchgeführt** und nicht als erledigt markiert.
- **EAS:** Kein Cloud-Build ausgelöst. Das Live-Aktivität-Ziel entsteht in einem sauberen Prebuild aus `git archive HEAD` (ohne `ios/`, `android/`), mit der lokalen `node_modules`. Offen: Xcode-26-Übersetzung von `expo-live-activity`, Signierung beider Ziele, ob `image: latest` wirklich Xcode 26 ist, ob die Cloud dieselben Paketversionen bekommt.
- **Backend:** Es gibt keins. `docs/road-data-backend.md` ist Planung; Kosten und Größen sind Schätzungen, nichts wurde angefragt oder gemessen.
- **Android 13+:** Der Dialog und das Verhalten des Vordergrunddienstes ohne Recht sind ungeprüft.
- **Recht:** ODbL-Pflichten für abgeleitete Daten und Datenschutzentwurf sind nicht rechtlich geprüft.

## 4. Abweichungen vom Auftrag

- **A3:** Kein neues Feld `radiusTrend`; das vorhandene `shape` wird weiterverwendet (Entscheidung Max). „Zieht zu“ umgeht den Ansagefilter nur bei **deutlich** zuziehenden Kurven (≥ 2×, Stufe ≤ 5), nicht bei jeder (Entscheidung Max); `grade` ist ohnehin schon die Stufe des engsten Punkts.
- **A5:** Zusätzlicher Schalter „Kurze Ansagen“ trotz vorhandenem Stil „Kurz“ (Entscheidung Max). Der Schalter überstimmt den Stil. Im kurzen Modus bleibt „zieht zu“ bei deutlich zuziehenden Kurven. Das Orten in Fahrt wurde **nicht** gedrosselt (Vorschau und Vorlauf brauchen 1 Hz).
- **A6:** Der Server kommt zusätzlich zur Einstellung „Eigener Overpass-Server“ aus dem Build (`extra.roadData`). Ohne Server und mit gesperrten öffentlichen Servern meldet die App einen klaren Fehler.
- **A7:** `ROAD_DATA_ALLOW_PUBLIC=false` im Produktionsprofil: **Im Release funktioniert die Freie Fahrt nicht, bis es ein Backend gibt** (oder sie wird ausgeblendet; dafür gibt es keinen Schalter).
- **A4:** `version: 1` heißt jetzt `schemaVersion: 2`; Format 1 wird beim Lesen migriert.
- **Nebenbei:** Die Fixture-Simulation steckt jetzt in `test/freeride/fixtureSim.ts` (vorher in `engine.test.ts`), damit die Regressionstests dieselben Zahlen messen. Beide Fahrmodi dämpfen die angezeigte Konfidenz bei schlechtem GPS.

## 5. Offene Fragen an Max

1. **Hobby oder Produkt?** Davon hängt ab, ob ein Backend (Option 2 in `docs/road-data-backend.md`) gebaut wird. Bis dahin ist die Freie Fahrt im Release gesperrt. Soll sie in Version 1 dabei sein, ausgeblendet werden oder mit einem eigenen Beta-Server laufen?
2. **Stelvio-Erkennung (71 %):** Soll als Nächstes untersucht werden, warum Kurven fehlen (Nebenstraßen im Track, Kreuzungsabbrüche, OSM-Geometrie)? Das ist die eigentliche Ursache von B2, A2 ändert nur die Strenge.
3. **Stufen-Strenge:** Reicht 0,85, oder soll es nach den Beifahrer-Testfahrten angepasst werden? Spitzkehren auf Amalfi stiegen von 34 auf 60; stimmt das mit dem Gefühl auf der Straße?
4. **Live-Aktivität:** Sie zeigt für unsichere Kurven weiter die Stufe (Feature-Stopp: nicht angefasst). Soll das in der nächsten Runde angepasst werden?
5. **Löschen von Aufzeichnungen:** Es gibt keine Funktion dafür (`deleteRecording` ist nirgends eingebunden). Für die Datenschutzerklärung wäre sie vor einem Release nötig.
6. **`image: latest`:** Beim ersten Cloud-Build im Log nachsehen, ob wirklich Xcode 26 benutzt wird. Wenn nicht, ein festes Image eintragen.
7. **Kalibrierung ab Frühjahr 2027:** Der Export der Aufzeichnung läuft über die Ergebnisansicht (JSON); unter Android wird er als Text geteilt (bei langen Fahrten ungeprüft). Reicht das, oder soll ein Dateiexport her?
8. **Alte Projektkopie / Ordner im iCloud-Desktop:** Aufgabe aus Abschnitt 3 des Auftrags, bei dir. Wichtig dabei: `ios/` enthält die lokalen Simulator-Screenshots (liegen nicht im Git) und wird bei `prebuild --clean` gelöscht; vorher sichern. Die Prüfung der Live-Aktivität lief deshalb in einem Scratch-Verzeichnis, nicht im Projekt.
