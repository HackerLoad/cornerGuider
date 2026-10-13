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
- Ein **Versuchs-Screen in der App** („Freifahrt (Versuch)"), der live den vorhergesagten Pfad und die Kurven zeigt, die Fahrt aufzeichnet und sich hinterher selbst auswertet

Nicht drin:
- Kreuzungslogik (Abbiegen, Kreisverkehre, Vorhersage über Kreuzungen hinweg)
- Offline-Regionspakete
- Sprachansagen für Freifahrt, Hintergrundbetrieb

Beim Pfadende an einer Kreuzung gibt es „keine weitere Vorhersage" und keine Ansage darüber hinaus.

## Messmethode (in der App, ohne vorhandene Aufzeichnungen)

Es gibt keine eigenen Aufzeichnungen und der Versuch läuft nicht als Skript. Die „Wahrheit" entsteht deshalb **während des Versuchs selbst**:

1. Der Versuchs-Screen nutzt die normale Positionsquelle (echtes GPS oder die Simulation) und sagt laufend den Pfad voraus. Jede Vorhersage wird mit Zeitpunkt gespeichert (Position, Pfad, vorhergesagte Kurven).
2. Gleichzeitig wird die tatsächlich gefahrene Spur aufgezeichnet.
3. Nach der Fahrt berechnet die App aus der **gefahrenen Spur** mit `detectCurves` die tatsächlichen Kurven und vergleicht sie mit den gespeicherten Vorhersagen. Die Kennzahlen erscheinen als Ergebnisseite in der App.
4. Optional lässt sich die Fahrt als GPX exportieren, dann lässt sie sich später wiederverwenden.

Entwickeln und Testen ohne Motorrad:

- Die Simulation fährt die vorhandenen Fixtures (`stelvio.gpx`, `amalfi-coast.gpx`) ab und dient als Testfahrt für die Pipeline und die Auswertung.
- Die Overpass-Antworten dieser Strecken werden einmal als JSON gespeichert (`test/fixtures/overpass-*.json`), damit Jest-Tests für Graph, Matching und Vorhersage offline und deterministisch laufen. Das sind nur Unit-Tests der Bausteine, keine Auswertung.
- Aussagekräftig ist erst die Fahrt mit echtem GPS auf echten Straßen. Die Simulation prüft nur, ob die Technik läuft, nicht wie gut die Vorhersage in der Praxis ist.

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
6. **Versuchs-Screen und Aufzeichnung** (`app/freeride.tsx`, `src/freeride/trace.ts`)
   - Zeigt Straße voraus, vorhergesagte Kurven (Kurvengrafik und Liste wie im Fahrmodus) und den Grund, wenn der Pfad endet („Kreuzung", „Daten werden geladen")
   - Zeichnet Spur und Vorhersagen lokal auf, Start/Stopp per Knopf
   - Quellenangabe „© OpenStreetMap-Mitwirkende" sichtbar
7. **Selbstauswertung** (`src/freeride/evaluate.ts`, reines TS, plus Ergebnisseite): vergleicht gespeicherte Vorhersagen mit den Kurven der gefahrenen Spur und berechnet die Kennzahlen. Per Jest mit der simulierten Fahrt getestet.
8. **Bericht**: Ergebnis und Go/No-Go-Entscheidung kurz in diese Datei schreiben.

Tests pro Schritt mit synthetischen Straßennetzen (Gerade, Kurve, Gabelung) plus den gespeicherten Overpass-Fixtures.

## Wiederverwendung

- Kurvenerkennung: `src/curves/detect.ts`
- Projektion, Resampling, Snapping: `src/geo/*`
- Simulation: `src/drive/simulator.ts`
- Testfahrt für die Simulation: `test/fixtures/*.gpx`
- Positionsquellen, Tracker-Anbindung und Fahrmodus-Komponenten (`CurveGraphic`) aus `src/drive/*` und `src/components/*`

## Risiken und offene Punkte

- **Datenqualität:** Die OSM-Geometrie kann bei Bergstraßen zu grob oder zu fein sein und von der gefahrenen Linie abweichen. Genau das misst der Versuch.
- **Parallele Straßen und Serpentinen:** Nahe liegende Straßen können falsch zugeordnet werden (Kurs- und Hysterese-Logik wird hier getestet).
- **Verfügbarkeit:** Overpass braucht Netz. Das Ergebnis des Versuchs sagt nichts über Offline-Betrieb; dafür wäre Stufe 2 (Regionspakete) nötig.
- **Lizenz:** Quellenangabe „© OpenStreetMap-Mitwirkende" (ODbL) muss in jeder späteren App-Version sichtbar sein.
- **Sicherheit:** Auch bei guten Kennzahlen darf die Freifahrt nur mit klarer Kennzeichnung „vorhergesagt, nicht geplant" ausgeliefert werden; an unsicheren Stellen wird geschwiegen.

Entschieden:
- Keine vorhandenen Aufzeichnungen nötig, die Fahrt zeichnet sich selbst auf.
- Der Versuch läuft in der App, nicht als Skript.

Noch offen:
- Auf welcher Strecke willst du die erste echte Testfahrt machen? Sinnvoll wäre eine Landstraße mit mehreren Kurven und möglichst wenigen Kreuzungen.
- Wer fährt: Wenn du selbst fährst, muss der Versuchs-Screen ohne Bedienung während der Fahrt laufen. Alternativ als Beifahrer oder im Auto testen, das ist für die Kennzahlen unkritisch.
