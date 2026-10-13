# Plan: Overpass-Versuch für die Freifahrt (ohne Route)

Status: Plan, nichts davon ist implementiert. Kontext siehe README, Abschnitt „Geplant: Freifahrt ohne Route".

## Ziel

Herausfinden, ob sich aus OpenStreetMap-Daten (Overpass-API) der Straßenverlauf **geradeaus** gut genug vorhersagen lässt, um Kurven ohne geplante Route anzusagen. Der Versuch beantwortet eine Frage: **Lohnt sich der Ausbau zur echten Freifahrt?** Er ist kein Produktfeature.

## Umfang

Drin:
- Straßen im Umkreis der Position per Overpass laden, lokal cachen
- Position der aktuellen Straße zuordnen (Map-Matching)
- Der Straße ~500 m voraus folgen, bis zur ersten Kreuzung
- Auf dem vorhergesagten Pfad die vorhandene Kurvenerkennung (`detectCurves`) laufen lassen
- Messen, wie nah das an den Kurven ist, die man tatsächlich fährt

Nicht drin:
- Kreuzungslogik (Abbiegen, Kreisverkehre, Vorhersage über Kreuzungen hinweg)
- Offline-Regionspakete
- Eigene UI, Sprachansagen für Freifahrt, Hintergrundbetrieb

Beim Pfadende an einer Kreuzung gibt es „keine weitere Vorhersage" und keine Ansage darüber hinaus.

## Messmethode (zuerst, ohne Gerät)

Die vorhandenen GPX-Tracks (`test/fixtures/stelvio.gpx`, `amalfi-coast.gpx`) dienen als **Wahrheit**, weil sie die tatsächlich gefahrene Strecke sind:

1. Aus dem Track werden Kurven berechnet (Referenz, wie heute).
2. Ein simulierter Fahrer fährt den Track ab (`SimulatedLocationSource`, optional mit GPS-Rauschen).
3. An vielen Punkten des Tracks wird nur mit Position und Kurs per OSM-Pfad vorhergesagt.
4. Vorhergesagte Kurven im Horizont (z. B. 400 m) werden mit den Referenzkurven verglichen.

Overpass-Antworten werden einmal als JSON gespeichert (`test/fixtures/overpass-*.json`). Alle Tests und die Auswertung laufen danach **offline und deterministisch**.

### Kennzahlen

- **Trefferquote:** Anteil der Referenzkurven bis Stufe 4 im Horizont, die vorhergesagt werden (Position ±30 m, Stufe ±1)
- **Falschmeldungen:** vorhergesagte Kurven ohne Referenzkurve, pro 10 km
- **Pfadlänge:** wie oft reicht der Pfad wirklich die vollen 400 m, bevor eine Kreuzung ihn beendet
- **Matching-Fehler:** Anteil der Positionen, die der falschen Straße zugeordnet werden
- **Overpass:** Antwortzeit (Median/p95), Datenmenge pro 10 km Strecke

### Vorschlag für Go/No-Go (vor dem Lauf festlegen, danach nicht anpassen)

| Kennzahl | Go |
| --- | --- |
| Trefferquote (Stufe 1–4) | ≥ 90 % |
| Falschmeldungen | < 1 pro 10 km |
| Matching-Fehler | < 2 % |
| Overpass p95 | < 3 s je Abfrage (mit Vorladen unkritisch) |

Die Zahlen sind Startwerte und gemeinsam zu bestätigen.

## Schritte

1. **Overpass-Client** (`src/freeride/overpassClient.ts`)
   - Abfrage: Straßen (`highway`) im Umkreis, mit Geometrie, z. B. `way(around:R,lat,lon)["highway"]; out geom;`
   - Nur befahrbare Klassen (Fuß-, Rad-, Reitwege usw. ausschließen); `oneway`, `name`, `ref`, `highway` mitnehmen
   - Eigener `User-Agent`, Timeout, Wiederholung mit Wartezeit, Nutzungsrichtlinien der gewählten Instanz beachten
   - Cache nach Rasterzellen (z. B. ~1 km), Vorladen in Fahrtrichtung
2. **Straßengraph** (`roadGraph.ts`, reines TS): OSM-Ways in lokale Meter projizieren, in Segmente zerlegen, Räumlicher Index über Rasterzellen. Gemeinsame Knoten als Kreuzungen erkennen.
3. **Map-Matching** (`mapMatch.ts`): nächstes Segment innerhalb ~25 m, dessen Richtung zum Fahrtkurs passt (< ~45°). Hysterese, damit die Zuordnung nicht flackert. Dafür braucht `Fix` zusätzlich `heading`.
4. **Pfadvorhersage** (`predictPath.ts`): der Straße in Fahrtrichtung folgen bis Horizont oder Kreuzung; Pfad zurückgeben mit Kennzeichnung, *warum* er endet (Horizont, Kreuzung, Datenende).
5. **Kurven auf dem Pfad**: `detectCurves` auf dem vorhergesagten Pfad, Ergebnis relativ zur aktuellen Position.
6. **Auswertung** (`scripts/freeride-eval.ts`): Messmethode oben, Ausgabe der Kennzahlen als Tabelle.
7. **Bericht**: Ergebnis und Go/No-Go-Entscheidung kurz in diese Datei schreiben.

Tests pro Schritt mit synthetischen Straßennetzen (Gerade, Kurve, Gabelung) plus den gespeicherten Overpass-Fixtures.

## Wiederverwendung

- Kurvenerkennung: `src/curves/detect.ts`
- Projektion, Resampling, Snapping: `src/geo/*`
- Simulation: `src/drive/simulator.ts`
- Tracks als Wahrheit: `test/fixtures/*.gpx`

## Risiken und offene Punkte

- **Datenqualität:** Die OSM-Geometrie kann bei Bergstraßen zu grob oder zu fein sein und von der gefahrenen Linie abweichen. Genau das misst der Versuch.
- **Parallele Straßen und Serpentinen:** Nahe liegende Straßen können falsch zugeordnet werden (Kurs- und Hysterese-Logik wird hier getestet).
- **Verfügbarkeit:** Overpass braucht Netz. Das Ergebnis des Versuchs sagt nichts über Offline-Betrieb; dafür wäre Stufe 2 (Regionspakete) nötig.
- **Lizenz:** Quellenangabe „© OpenStreetMap-Mitwirkende" (ODbL) muss in jeder späteren App-Version sichtbar sein.
- **Sicherheit:** Auch bei guten Kennzahlen darf die Freifahrt nur mit klarer Kennzeichnung „vorhergesagt, nicht geplant" ausgeliefert werden; an unsicheren Stellen wird geschwiegen.

Offene Fragen an dich:
- Welche Strecken kennst du gut und könnten als zusätzliche Wahrheit dienen (eigene GPX-Aufzeichnung)?
- Soll der Versuch zuerst nur im Skript laufen (empfohlen) oder gleich auf dem Gerät?
