# Straßendaten-Backend für die Freie Fahrt (Planung, nicht umgesetzt)

Stand: Review-Runde 2026-10. **Dieses Dokument ist Planung. Es wurde nichts gebaut, bestellt oder gemessen.** Alle Zahlen zu Kosten, Größen und Zeit sind **grobe Schätzungen aus Erfahrungswerten, nicht geprüft**; vor einer Entscheidung die aktuellen Preise und Datenmengen nachsehen (Geofabrik-Seite der Regionen, Preislisten der Anbieter).

## Ausgangslage

- Die Freie Fahrt lädt Straßen kachelweise (`src/freeride/tiles.ts`, Zoom 14) über `fetchOverpass` von **öffentlichen Overpass-Servern** (`overpass.openstreetmap.fr`, `overpass-api.de`, `maps.mail.ru`).
- Öffentliche Overpass-Server sind für den Betrieb einer Anwendung mit vielen Nutzern nicht gedacht (Fair-Use-Regeln, Überlastung mit 429/504, kein Verfügbarkeitsversprechen). Ein Release darauf ist ein **Release-Blocker**.
- Seit dieser Runde gibt es die Schnittstelle `RoadDataSource` (`src/freeride/roadDataSource.ts`). Die Freie Fahrt kennt nur sie. Dahinter stehen heute `OverpassSource` (mit eigenem User-Agent, Begrenzung pro Minute und konfigurierbaren Servern) und der Speicher auf dem Gerät (`TileLoader`, 30 Tage frisch, bei Netzfehlern auch veraltet nutzbar).
- Build-Konfiguration (`app.config.ts`, `extra.roadData`): `ROAD_DATA_URL` (eigener Server), `ROAD_DATA_ALLOW_PUBLIC=false` (öffentliche Server sperren), `ROAD_DATA_CONTACT` (im User-Agent), `ROAD_DATA_MAX_PER_MINUTE`. Mit `ROAD_DATA_ALLOW_PUBLIC=false` und ohne Server meldet die App „Kein Straßendaten-Server eingerichtet“, statt still auf die öffentlichen Server auszuweichen.
- Was die App pro Kachel braucht (`OsmWay`): Way-ID, Knoten-IDs (gemeinsame IDs sind Kreuzungen), Geometrie und aus den Tags nur `highway`, `name`, `ref`, `oneway`, `junction=roundabout`. Das ist wenig Information.

## Fragen vorab (Max)

Die Wahl hängt an der offenen Frage aus dem Review, **ob das ein Hobby-/Portfolio-Projekt oder ein Produkt mit Nutzern wird.** Für wenige Beta-Tester genügt Option 1 oder sogar der eigene Server aus den Einstellungen. Für viele Nutzer ist Option 2 die tragfähige.

## Option 1: Eigener Overpass-Server (Docker)

**Idee:** Ein eigener Overpass-Server mit einem OSM-Auszug für Deutschland und die Alpen. Die App fragt unverändert per Overpass-Abfrage. `OverpassSource` bleibt, nur die URL ändert sich (`ROAD_DATA_URL`). Das Client-Verhalten (Kacheln, Speicher, Wiederholungen) ändert sich nicht.

**Aufbau**
- Docker-Image mit Overpass (z. B. das verbreitete Community-Image `wiktorn/overpass-api`), Daten aus Geofabrik-Auszügen (Deutschland und „Alps“), automatische Aktualisierung über die Diff-Dateien der Auszüge.
- Hinter einem Reverse-Proxy (TLS, Rate-Limit pro IP, Zugriffsprotokoll ohne Positionsdaten), ein kleiner Server mit schneller SSD.

| | Schätzung (nicht geprüft) |
| --- | --- |
| Einrichtung | 1–2 Tage (Image, erste Datenladung, Proxy, Überwachung) |
| Erstimport | Stunden, abhängig von CPU und Platte |
| Platte | Größenordnung 100 GB inkl. Reserve für Deutschland plus Alpen; vorher mit den aktuellen Auszugsgrößen nachrechnen |
| Server | etwa 4 Kerne, 16 GB RAM, SSD; bei Standard-Cloud-Anbietern typisch im Bereich einiger 10 € pro Monat |
| Laufende Arbeit | Updates überwachen, Platte und Last beobachten, Sicherheitsupdates; bei einem Ausfall ist die Freie Fahrt ohne Netz-/Speicherdaten tot |

**Vorteile:** Schnell umgesetzt, kein Client-Code nötig, flexible Abfragen. **Nachteile:** Ein einzelner Server ist ein einzelner Ausfallpunkt; jede Anfrage verrät dem Betreiber die Position (Kachelmittelpunkt) und die IP; Skalierung kostet Server; Dauerbetrieb und Wartung.

## Option 2: Vorberechnete Straßenkacheln aus einem OSM-PBF-Auszug

**Idee:** Eine Pipeline erzeugt aus dem PBF-Auszug (Deutschland, Alpen) für jede Kachel (Zoom 14, wie die App sie schon kennt) eine kleine Datei mit den Straßen. Die Dateien liegen als statische Dateien auf einem Dateispeicher mit CDN. Die App lädt sie wie bisher kachelweise nach (oder als Regionspaket vorab) und speichert sie im bestehenden Kachelspeicher.

**Aufbau**
1. **Pipeline** (Skript, z. B. mit `osmium` zum Filtern auf `highway=*` der in `ROAD_CLASSES` genannten Klassen, dann ein kleines Skript, das pro Kachel `OsmWay`-kompatibles JSON schreibt, nur mit den fünf benötigten Tags, Koordinaten auf wenige Nachkommastellen gerundet, gzip). Läuft einmal im Monat oder Quartal, z. B. als geplanter Job.
2. **Hosting:** statische Dateien `…/{z}/{x}/{y}.json.gz` plus eine `manifest.json` mit Datenstand und Prüfsumme. Ein Dateispeicher mit CDN reicht; es gibt keinen Server, der läuft.
3. **App:** eine neue `RoadDataSource` (z. B. `TileServerSource`), die die Datei per `GET` holt. Alles dahinter (`TileLoader`, Speicher, Vorladen pro Strecke) bleibt. 404 heißt „Kachel ohne Straßen“.

| | Schätzung (nicht geprüft) |
| --- | --- |
| Einrichtung | 3–5 Tage (Pipeline, Hosting, `TileServerSource`, Versionierung, Tests) |
| Umfang | Deutschland und Alpen zusammen grob einige 10 000 bis 100 000 nichtleere Kacheln; Gesamtgröße im Bereich von einigen GB (aus den kleinen Fixtures hochgerechnet, `osm-amalfi.json` hat rund 90 KB roh; nicht kachelweise gemessen) |
| Hosting | statisch; bei den üblichen Anbietern für Objektspeicher typisch einige € pro Monat; Datenverkehr hängt von der Nutzerzahl ab (Anbieter ohne Gebühr für ausgehenden Verkehr sind hier im Vorteil) |
| Laufende Arbeit | Pipeline bei neuen Auszügen starten und prüfen; sonst kaum Betrieb; keine Serverwartung |

**Vorteile:** Kein Server, der ausfallen kann; skaliert über das CDN; offline-freundlich (passt zum vorhandenen Kachelspeicher und zum Vorladen pro Strecke); datensparsam (nur die Kachelnummer, nicht die genaue Position, geht über die Leitung); gleichmäßige Antwortzeit. **Nachteile:** Daten sind so alt wie der letzte Pipeline-Lauf (für Straßen meist unkritisch); Pipeline und `TileServerSource` müssen gebaut und getestet werden; größere Änderungen am Kachelformat brauchen eine Versionierung.

## Vergleich

| | Option 1: eigener Overpass | Option 2: vorberechnete Kacheln |
| --- | --- | --- |
| Aufwand bis zum ersten Einsatz | niedrig (1–2 Tage) | mittel (3–5 Tage) |
| Laufender Betrieb | Server pflegen | fast keiner |
| Kosten | ein Server dauerhaft | Speicher plus Datenverkehr |
| Ausfallrisiko | Einzelserver | CDN, sehr gering |
| Datenschutz | jede Anfrage trägt Position und IP zum Betreiber | nur Kachelnummer, kein Positionsstrom an einen Dienst mit Logik |
| Skalierung | Server aufrüsten | CDN |
| Aktualität | kontinuierlich (Minuten bis Stunden) | je Pipeline-Lauf (Tage bis Wochen) |
| Offline | über den vorhandenen Speicher | über den vorhandenen Speicher, bequem als Regionspaket |

## Empfehlung

- **Ziel für ein Produkt mit Nutzern: Option 2.** Es gibt keinen Dauerbetrieb, es skaliert, es ist datensparsamer und passt zur bestehenden Kachel-/Offline-Architektur der App. Der Mehraufwand ist einmalig.
- **Option 1 nur als Zwischenlösung**, wenn früher als die Pipeline fertig ist eine Beta mit wenigen Testern laufen soll: kleiner Server, `ROAD_DATA_URL` setzen, `ROAD_DATA_ALLOW_PUBLIC=false`.
- **Für ein reines Hobbyprojekt** (nur eigene Fahrten): ohne Backend. Den eigenen Server aus den Einstellungen nutzen oder die Kacheln vorab pro Strecke laden (`Offline laden` auf der Routenseite). Dann **kein öffentlicher Release** der Freien Fahrt auf den öffentlichen Servern.
- **Vor einem Release, egal welche Option:** `ROAD_DATA_ALLOW_PUBLIC=false` im Produktionsprofil (siehe `docs/release/checklist.md`), Datenschutzerklärung an den tatsächlichen Dienst anpassen (heute nennt sie die öffentlichen Overpass-Server), Quellenangabe „© OpenStreetMap-Mitwirkende“ (ODbL) beibehalten.

## Lizenz (ODbL)

Die abgeleiteten Straßendaten (Kacheln und Antworten eines eigenen Overpass-Servers) sind weiter OpenStreetMap-Daten unter der ODbL. Die Quellenangabe „© OpenStreetMap-Mitwirkende“ mit Link auf https://www.openstreetmap.org/copyright steht in den Einstellungen (Abschnitt „Über“) und auf den Seiten der Freien Fahrt. Zu den Pflichten bei veröffentlichten abgeleiteten Datenbanken (Weitergabe unter gleichen Bedingungen) gibt es **noch keine rechtliche Prüfung**; das gehört zur offenen rechtlichen Einschätzung vor dem Release.

## Nicht Teil dieser Runde

Umsetzung beider Optionen, eine `TileServerSource`, Regionspakete in der Oberfläche, Hosting-Entscheidung und Kosten.
