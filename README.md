# cornerGuider

Cross-Platform-App (iOS + Android) für Motorradfahrer. Sie zeigt und sagt während der Fahrt die **nächste Kurve** auf einer geplanten GPX-Route an – nur Kurven, keine Abbiegehinweise, keine Karte.

- Oben: „In 240 m: Rechts 3"
- Darunter: große Kurvengrafik, aus den echten Koordinaten gerendert, in Fahrtrichtung nach oben: zweispurige Straße mit Gegenspur und Mittellinie, der Kurvenabschnitt am Rand in der Farbe der Stufe und eine **Fahrlinie** in der eigenen Spur (außen – Scheitel innen – außen; der Scheitel liegt bei zugehenden Kurven später)
- Darunter: die nächsten Kurven als kompakte Liste
- Sprachansagen über Lautsprecher oder Bluetooth-Headset sind der Hauptkanal, das Display ergänzt

> **Sicherheit:** Die Fahrlinie ist ein rein geometrischer Vorschlag innerhalb der eigenen Spur (Rechtsverkehr, Straße = Mittellinie der GPX-Route) und kein Fahrhinweis. Die Kurvendaten werden aus GPX-Dateien berechnet und können ungenau sein. Die App gibt keine Geschwindigkeitsempfehlung. Der tatsächliche Straßenverlauf hat immer Vorrang. Beim ersten Start muss ein Sicherheitshinweis bestätigt werden.

## Status

MVP-Funktionen sind implementiert, aber **noch nicht auf einem Gerät getestet** (geprüft sind Unit-Tests, Typecheck und der JS-Bundle-Export).

| Bereich | Stand |
| --- | --- |
| Kurvenerkennung (`src/curves`) + CLI | fertig, getestet |
| GPX-Import, Speicherung, Routenliste, Kurvenübersicht | fertig, nicht auf Gerät getestet |
| Tracker (Snapping, Off-Route, Latenzausgleich) | fertig, getestet |
| Fahrmodus, Kurvengrafik, Sprachansagen, Hintergrund-Ortung | fertig, nicht auf Gerät getestet |
| Simulationsmodus | fertig, getestet |
| Freie Fahrt (OSM, Versuch) | Kern getestet, Oberfläche im Simulator und bei einer kurzen Autofahrt geprüft |
| Go-Startseite mit Tabs, Einstellungen, Querformat | fertig, im iOS-Simulator geprüft (Tabs/Einstellungen/Live-Aktivität noch nicht gesehen) |
| Live-Aktivität (iOS) | Logik getestet, Build-Konfiguration erzeugt; auf Gerät/Simulator nicht gesehen |
| Web-Demo (`web-demo/`) | fertig, im Browser geprüft |
| Englische Oberfläche (Sprache der App) | fertig, getestet (Schlüsselparität), im Simulator noch nicht gesehen |
| Feedback (Falsch/Fehlt-Knöpfe, Bewertung der Ansagen, Export) | fertig, getestet, im Simulator noch nicht gesehen |
| Freie Fahrt offline (Kachel-Speicher, Download pro Strecke, eigener Server) | fertig, Logik getestet, Kachelabfrage an echten Daten geprüft |
| Splash-Screen, Android-Icons (inkl. Monochrom) | konfiguriert, Icons gerendert geprüft; auf Gerät nicht gesehen |

Bekannte offene Punkte:

- **Musik ducken:** iOS dämpft die Musik über `useApplicationAudioSession: false` von selbst. `expo-speech` fordert unter Android keinen Audio-Fokus an (im Quellcode bestätigt); deshalb hält dort ein stilles Audiosignal (`src/services/ducking.ts`) den Fokus, solange gesprochen wird. **Auf einem echten Gerät noch nicht geprüft**, Android wurde nie gebaut.
- **Kurvenstufen:** Die Schwellwerte in `src/curves/config.ts` sind Schätzwerte und noch nicht an echten Fahrten kalibriert.
- **Kurvengrafik:** Das Layout (v. a. die Position der Stufenzahl) ist noch nicht auf einem Gerät gesehen.
- **Dateiimport:** Dateiauswahl, „Öffnen mit"/Teilen und iOS-Dokumenttyp sind noch nicht auf einem Gerät geprüft.

## Nicht geprüft

Stand der Review-Runde 2026-10 (siehe `docs/review-2026-10.md`). Wird nach jeder Aufgabe aktualisiert. Nur Unit-Tests, Typecheck und CLI-Läufe auf GPX/OSM-Fixtures sind gelaufen.

- Fahrt auf einem Motorrad: nie. Die Kurvenstufen sind nicht kalibriert.
- Android: wurde nie gebaut. Audio-Fokus/Ducking ist ungeprüft.
- Zusammenspiel mit einer parallel laufenden Navi-App: ungeprüft.
- Kurvengrafik-Layout, Dateiimport, Tabs/Einstellungen und Live-Aktivität auf einem Gerät: ungesehen.
- Freie Fahrt mit echtem Fahrzeug-GPS: nur eine kurze Autofahrt.
- Store-Builds über EAS: nicht ausgelöst. Das Live-Activity-Ziel entsteht in einem sauberen Prebuild aus `git archive` (lokal geprüft, siehe `docs/release/checklist.md`); ein echter Cloud-Build, Signierung beider Ziele und der Xcode-26-Build von `expo-live-activity` sind **nicht geprüft**. Ob `"image": "latest"` bei EAS Xcode 26 liefert, ist ungeprüft.
- Benachrichtigungsrecht (A8): Die Abfrage `POST_NOTIFICATIONS` (Android 13+) und der Hinweis bei Ablehnung sind nur per Unit-Test der Entscheidungslogik geprüft. Android wurde nie gebaut; ob der Dialog erscheint, ob der Vordergrunddienst ohne das Recht wirklich unzuverlässig ortet und ob der Hinweis zur Situation passt, ist **nicht geprüft**.
- Straßendaten-Quelle (A6): `RoadDataSource`, Begrenzung pro Minute und User-Agent sind nur gegen simulierte Antworten geprüft, nicht gegen einen echten Server. Es gibt kein eigenes Backend, `docs/road-data-backend.md` ist Planung mit geschätzten Kosten. Solange `ROAD_DATA_ALLOW_PUBLIC` nicht auf `false` steht, nutzt jeder Build die öffentlichen Overpass-Server (**Release-Blocker**). Der Über-Abschnitt und der Lizenz-Link wurden auf keinem Gerät gesehen; die rechtliche Prüfung der ODbL-Pflichten steht aus.
- Zusammenspiel mit einer Navi-App (A5): Weder Audio-Fokus/Ducking noch Überlagerungen noch der Akkuverbrauch bei zwei ortenden Apps wurden auf einem Gerät geprüft; `docs/audio-behavior.md` ist aus dem Quellcode gelesen. Das Testprotokoll `docs/test-protocol-navi.md` ist **nicht durchgeführt**. Der Schalter „Kurze Ansagen“ und das sparsame Orten der Freien Fahrt im Stand sind nur per Unit-Test geprüft.
- Aufzeichnung für die Kalibrierung (A4): Das Format, `npm run calibrate` und die Berechnung laufen nur gegen Simulation und synthetische Fahrten. Der Bewegungssensor (`expo-sensors`, Plugin in `app.config.ts`) wurde auf keinem Gerät gelesen; ob er in der Tasche/am Lenker, bei gesperrtem Display und im Hintergrund liefert, ob iOS eine Bewegungsabfrage zeigt und wie gut die Neigung aus der Schwerkraftrichtung zur echten Schräglage passt, ist ungeprüft. Für das Plugin ist ein `npx expo prebuild --clean` nötig. Das Löschen einer Aufzeichnung (Knopf mit Rückfrage in der Freie-Fahrt-Liste) ist nur per Typecheck geprüft, nicht auf einem Gerät.
- „Zieht zu" / „öffnet" (A3): Schwellwerte (`shapeRatio`, `shapePeakFraction`, `strongTighteningRatio`) sind geschätzt. Stichprobe von 5 Stelvio-Kurven nur per Rechnung am GPX-Track geprüft, nicht gefahren. Die Markierung in der Kurvengrafik wurde auf keinem Gerät gesehen.
- Sicherheitsabschlag (A2): 0,85 ist ein Schätzwert aus vier probierten Werten (0,9 / 0,85 / 0,8 / 0,75), nicht kalibriert. Ob die strengeren Stufen zu echten Kurven auf dem Motorrad passen, ist ungeprüft.
- Konfidenz (A1): Schwellwerte in `src/curves/config.ts` sind geschätzt. Die gestrichelte Darstellung unsicherer Kurven und die Ansagen „Kurve, unsicher" / „Keine Vorschau" wurden nicht auf einem Gerät gesehen oder gehört. Die Live-Aktivität zeigt für unsichere Kurven weiterhin die Stufe (bewusst nicht angefasst, siehe Feature-Stopp).

### Messwerte Kurvenerkennung (CLI, `test/fixtures/*.gpx`)

| Stand | Stelvio (Kurven / Stufen 1–6) | Amalfi (Kurven / Stufen 1–6) |
| --- | --- | --- |
| Vor der Review-Runde (19.10.2026) | 235 / 71·20·60·57·24·3 | 358 / 34·155·108·51·9·1 |
| Nach A1 (Stufen unverändert) | 235, davon 26 unsicher (Konfidenz < 0,4) | 358, davon 11 unsicher |
| Nach A2 (Abschlag 0,85, bei Konfidenz < 0,7 eine Stufe enger) | 235 / 76·35·62·44·17·1 | 358 / 60·153·102·39·3·1 |

Form der Kurven (A3, CLI): „zieht zu" Stelvio 61 von 235 (davon deutlich zuziehend 35), Amalfi 104 von 358 (65). Bei dem Standardfilter „ab Stufe 4" umgeht dadurch nur 1 Kurve (Stelvio) bzw. keine (Amalfi) den Filter; erst bei strengeren Filtern spielt die Regel eine Rolle. Vor der Korrektur galten auch Kurven mit dem engsten Punkt in der Mitte als „zieht zu" (Stelvio 94, Amalfi 149).

Freie Fahrt, Simulation entlang der Fixtures (`test/curves/regression.test.ts` hält die Werte fest):

| Stand | Stelvio: Ansagen richtig | Stelvio: Kurven bis Stufe 4 erkannt | Amalfi: Ansagen richtig | Amalfi: Kurven bis Stufe 4 erkannt |
| --- | --- | --- | --- | --- |
| Vor der Review-Runde (Abschlag 0,9) | 85 % (33/39) | 71 % (24/34) | 99 % (76/77) | 97 % (70/72) |
| Nach A2 (Abschlag 0,85) | 85 % (33/39) | 70 % (26/37) | 99 % (76/77) | 97 % (72/74) |

Einordnung: Der Abschlag ändert nur die Einstufung, nicht die Erkennung. Auf Stelvio bleibt die Erkennungsquote praktisch gleich (70 statt 71 %): Es fehlen weiter 11 von 37 Kurven bis Stufe 4, A2 hat daran nichts verbessert. Die Nenner verschieben sich, weil durch die strengere Einstufung mehr Kurven in „bis Stufe 4" fallen (Stelvio 34 → 37, Amalfi 72 → 74). Die Zahl der Spitzkehren (Stufe 1) steigt dadurch auf Amalfi von 34 auf 60 und auf Stelvio von 71 auf 76; das ist gewollt (lieber zu streng), aber nicht an echten Fahrten geprüft.

## Stack

Expo SDK 54 / React Native 0.81 (Development Build, kein Expo Go; iOS-Build braucht Xcode ≥ 16.1) · React Native · TypeScript (strict) · expo-router · Zustand · expo-location + expo-task-manager · expo-speech + expo-audio · react-native-svg · expo-file-system · Jest

## Entwicklung

Voraussetzungen: Node, für iOS Xcode ≥ 16.1 und CocoaPods, für Android Android Studio mit einem virtuellen Gerät.

> Die Expo-Version ist bewusst SDK 54: SDK 55 und neuer verlangen Xcode 26 für den iOS-Build.

```bash
npm install

npm test              # Unit-Tests
npm run typecheck     # tsc --noEmit

npx expo run:ios      # Development Build im iOS-Simulator (erster Lauf dauert)
npx expo run:android  # Development Build im Android-Emulator
npm start             # Dev-Server für einen vorhandenen Build
```

### Kurven einer GPX-Datei ausgeben (ohne App)

```bash
npm run curves -- test/fixtures/stelvio.gpx
```

Gibt pro Kurve Start, Länge, Richtung, Stufe, Mindestradius, Winkel, Form (zieht zu/öffnet) und Folgen aus.

### Ohne Motorrad testen: Simulationsmodus

1. App im Simulator starten, Sicherheitshinweis bestätigen.
2. GPX importieren (z. B. `test/fixtures/stelvio.gpx` per Drag & Drop auf den Simulator ziehen, dann in der App auswählen).
3. Route öffnen → **Simulation starten**. Die Fahrt läuft ohne GPS und ohne Standortberechtigung.
4. Steuerleiste: Tempo ±10 km/h, Pause, 500 m vorspringen, „Abweichen" (120 m seitlicher Versatz, um Off-Route zu testen).

Die Simulation nutzt dieselbe Fahrmodus-Logik wie die echte Fahrt (`DriveSession`), nur die Positionsquelle ist ausgetauscht.

## Bedienung

Drei Tabs: **Go** (großer Startknopf), **Strecken** (Import und Auswahl) und **Einstellungen**. Der Go-Knopf fährt die gewählte Strecke („Go-Strecke", wird beim Import automatisch gewählt) oder startet die **Freie Fahrt**; der Umschalter oben auf der Go-Seite wählt zwischen beiden. Die Simulation startet über „Simulation" auf der Go-Seite oder in der Streckenübersicht.

## Einstellungen

| Bereich | Einstellung |
| --- | --- |
| Ansagen | Sprache an/aus, **Ansagen ab Stufe** (leichtere Kurven nur, wenn sie direkt auf eine angesagte folgen), Stil ausführlich/kurz, Form („zieht zu"/„öffnet") ansagen, Vorwarnzeit, Mindestabstand |
| Stimme | Ansagesprache (Deutsch/Englisch), Sprechtempo, Stimme aus den auf dem Gerät installierten, Test-Ansage |
| Anzeige | Ausrichtung (automatisch/hoch/quer), Einheiten (km·m / mi·ft), Rechts-/Linksverkehr (Spur der Fahrlinie), Fahrlinie ein/aus, Anzahl weiterer Kurven in der Liste |

Die Lautstärke der Ansagen richtet sich nach der Gerätelautstärke (ein eigener Regler wäre wirkungslos: `volume` von `expo-speech` gilt nur im Web).

## Sprache der App

Deutsch und Englisch, einstellbar unter Einstellungen → Anzeige → „Sprache der App" (Standard: Gerätesprache). Die Texte stehen in `src/i18n/dictionary.ts`; der Compiler erzwingt, dass jeder deutsche Schlüssel auch auf Englisch existiert, ein Test prüft die Platzhalter. Die **Sprache der Ansagen** ist getrennt einstellbar. Fehler, Import-Hinweise, gesprochene Systemtexte und die Live-Aktivität folgen der jeweiligen Sprache. Die Web-Demo ist bisher nur deutsch.

## Rückmeldungen (Feedback)

- **Knöpfe im Fahrmodus** (Einstellungen → Rückmeldungen, standardmäßig aus): „Falsch" und „Fehlt", gedacht für den **Beifahrer**. Die Markierung merkt sich Position, Zeit und die aktuelle Kurve.
- **Bewertung nach einer Freien Fahrt:** Jede angesagte Kurve lässt sich mit „Passt / Zu mild / Zu streng / Gab es nicht" bewerten. Ab 5 Bewertungen je Stufe und 40 % Abweichung erscheint ein Hinweis, dass die Schwellwerte angepasst werden könnten.
- **Export** (iOS: Datei im Teilen-Menü, Android: Text): Fahrt als GPX (Markierungen als Wegpunkte) oder alle Rohdaten als JSON; alle Markierungen unter Einstellungen.
- Alles bleibt auf dem Gerät, es gibt keinen Server. Auswertung der Daten ist Handarbeit: Die Kalibrierung der Stufen (`src/curves/config.ts`) und neue Testfälle entstehen aus den exportierten Dateien.

## Freie Fahrt offline

Die Straßendaten werden in **Kacheln** (Web-Mercator, Zoom 14, ca. 1,7 km) geladen und auf dem Gerät gespeichert (`osm/`, 30 Tage frisch; bei Netzfehler werden auch ältere Daten genutzt). In der Streckenübersicht lädt „Offline laden" alle Kacheln entlang einer Strecke vorab, damit die Freie Fahrt dort ohne Netz läuft. Gemessene Größen: Bergregion ~60 KB, Amalfi ~65 KB, Großstadt ~830 KB je Kachel. Unter Einstellungen → Straßendaten lässt sich ein **eigener Overpass-Server** eintragen (wird zuerst angefragt) und der Speicher leeren. Leere Kacheln (Wald, Wasser) werden erst akzeptiert, wenn zwei Server sie bestätigen.

## Live-Aktivität (iOS)

Die nächste Kurve erscheint auf dem Sperrbildschirm und in der Dynamic Island: Pfeil mit Stufenzahl in der Stufenfarbe, „Rechts 3 · In 240 m" und ein Fortschrittsbalken, der beim Näherkommen wächst (`expo-live-activity`, iOS 16.2+). Aktualisiert wird nur bei geänderter Anzeige und höchstens alle 2 s. Die Bilder erzeugt `scripts/make-live-activity-images.py` (je < 4 KB, Grenze von ActivityKit). In einem Build ohne das native Modul und unter Android passiert nichts. Braucht einen neuen nativen Build (`npx expo prebuild --clean --platform ios`).

## Web-Demo

`web-demo/` ist ein eigenes Vite-Projekt, das die Kernlogik der App direkt nutzt: GPX laden, Kurven ansehen, Fahrmodus-Vorschau mit Kurvengrafik abspielen. Läuft komplett im Browser, siehe `web-demo/README.md`.

## Veröffentlichung

Entwürfe und Checkliste unter `docs/release/` (Datenschutzerklärung, Store-Texte, Schritte für TestFlight und Play-Store-Test), `eas.json` mit den Build-Profilen. Das Briefing für die Website steht in `docs/website-brief.md`. Vieles hängt noch von offenen Entscheidungen ab.

## Ausrichtung

Die App dreht sich mit dem Handy (oder bleibt fest hoch/quer, siehe Einstellungen). Im **Querformat** (Handy quer am Lenker) zeigt der Fahrmodus links Kopfzeile, Kurvenliste und Knöpfe, rechts die große Kurvengrafik (`src/components/DriveLayout.tsx`); im Hochformat steht alles untereinander. Nach einer Änderung der Ausrichtung in `app.config.ts` muss der native Build neu erzeugt werden (`npx expo prebuild --clean --platform ios`, dann `npx expo run:ios`).

## Funktionsweise

### Kurvenerkennung (`src/curves`, reines TS)

1. Koordinaten in lokale metrische Projektion (equirectangular um den Routenmittelpunkt)
2. Resampling auf ~5 m, leichte Glättung (gleitender Mittelwert)
3. Lokaler Radius per Umkreis aus Punkten mit ~15 m Abstand, Richtung über das Vorzeichen des Kreuzprodukts
4. Kurvensegmente: zusammenhängende Bereiche mit Radius < 400 m; kurze Lücken gleicher Richtung werden zusammengeführt, Gegenrichtung trennt Kurven (S-Kurve = zwei Kurven)
5. Pro Kurve: Startdistanz entlang der Route, Länge, Mindestradius, Gesamtwinkel, Richtung, Form (zieht zu / öffnet / gleichmäßig)
6. Einstufung nach Rallye-Skala **1 = Spitzkehre … 6 = sehr leicht** aus dem Mindestradius, konservativ (Sicherheitsfaktor 0,9 – im Zweifel enger)
7. Kurven mit < 50 m Abstand werden als Folge markiert („Rechts 3, danach links 4")

Alle Schwellwerte stehen zentral in `src/curves/config.ts`.

| Stufe | Mindestradius (nach Sicherheitsfaktor) |
| --- | --- |
| 1 | ≤ 15 m |
| 2 | ≤ 30 m |
| 3 | ≤ 50 m |
| 4 | ≤ 80 m |
| 5 | ≤ 130 m |
| 6 | darüber (bis 400 m) |

### Live-Tracking (`src/tracking`)

- GPS-Punkt wird auf die Route projiziert; die Distanz zur nächsten Kurve wird **entlang der Route** gemessen, nicht in Luftlinie
- Nie rückwärts: Sprünge zurück durch GPS-Jitter werden ignoriert
- Off-Route: > 50 m Abstand für > 5 s → klare Anzeige „ABSEITS DER ROUTE" statt falscher Kurven; bei Rückkehr geht es automatisch weiter
- Latenzausgleich: Position wird mit Geschwindigkeit und Zeitstempel extrapoliert (höchstens 3 s)
- Fixes mit Genauigkeit schlechter als 100 m werden ignoriert
- Akku: im Stand (> 20 s) sparsamer orten, in Bewegung 1 Hz mit bester Genauigkeit

### Sprachansagen (`src/voice`)

- Vorlauf = Maximum aus Mindestabstand (Default 80 m) und Vorwarnzeit × Geschwindigkeit (Default 6 s); beides einstellbar
- Jede Kurve wird höchstens einmal angesagt, Kurvenfolgen in einer Ansage zusammengefasst
- Kurven, die zu spät erreicht werden (< 30 m, z. B. Start mitten auf der Route), werden übersprungen
- Beispiele: „In 240 Metern Rechts 3, zieht zu", „In 100 Metern Spitzkehre links"

## Projektstruktur

```
app/                     expo-router: Routenliste, Import, Routenübersicht, Fahrmodus, Einstellungen
src/
  geo/                   Projektion, Polyline (Resampling, Glättung), Linear Referencing   [reines TS]
  gpx/                   GPX-Parser (Track und Route)                                      [reines TS]
  curves/                Kurvenerkennung, Einstufung, Folgen, zentrale Config               [reines TS]
  routes/                Datenmodell der gespeicherten Route, Import-Warnungen              [reines TS]
  tracking/              RouteTracker, nächste Kurven, adaptives GPS-Profil                 [reines TS]
  voice/                 Ansage-Scheduler und deutsche Phrasen                              [reines TS]
  drive/                 DriveSession (Orchestrierung), Simulator, LocationSource-Interface
  services/              Adapter: expo-location/TaskManager, Sprache, Audio-Session, Dateien
  stores/                Zustand: Routenindex, Einstellungen (persistiert)
  components/            Kurvengrafik, Kurvenzeile, Sicherheitshinweis
scripts/curves-cli.ts    Kurvenliste einer GPX-Datei auf der Konsole
scripts/calibrate-cli.ts Auswertung einer Aufzeichnung (npm run calibrate, siehe docs/recording-format.md)
test/                    Jest-Tests, GPX-Fixtures unter test/fixtures
```

Schichten: `UI → stores → services → core (reines TS)`. Die Kernlogik hat keine React-Native-Abhängigkeiten und ist deshalb komplett per Jest und CLI testbar.

## Daten

- Importierte Routen liegen als JSON im Dokumentenordner der App (inkl. vorberechneter Kurven und Kurvengeometrie), der Index in AsyncStorage. Kein Backend, keine Accounts.
- **GPX-Hinweis:** Verwende Tracks oder dicht gepunktete Routen. Dateien mit nur wenigen Wegpunkten (Ø > 100 m Abstand) liefern ungenaue Kurven; die App warnt beim Import.
- Test-Fixtures (`test/fixtures`): Tracks aus [gpx-rider/gpx-rider.github.io](https://github.com/gpx-rider/gpx-rider.github.io) (MIT-Lizenz).

## Freie Fahrt (Versuch, OpenStreetMap)

Ohne geplante Route sagt die App den Straßenverlauf aus **OpenStreetMap**-Daten (Overpass-API) voraus und meldet daraus die kommenden Kurven. Auf der Startseite: **Freie Fahrt (Versuch)**.

**Ablauf** (`src/freeride/`, reines TS, getestet)

1. **Daten:** Straßen im Umkreis (1,5 km) werden per Overpass geladen und rechtzeitig vor der Fahrt nachgeladen. Die öffentlichen Server sind oft überlastet (504/429): Der Client wiederholt mit wachsender Wartezeit und wechselt den Server. Die Freie Fahrt kennt nur die Schnittstelle `RoadDataSource` (`src/freeride/roadDataSource.ts`); Server, User-Agent und Anfragen pro Minute kommen aus der Build-Konfiguration (`extra.roadData` in `app.config.ts`, siehe `docs/road-data-backend.md`).
2. **Map-Matching:** Position und Fahrtrichtung werden der wahrscheinlichsten Straße zugeordnet (Richtung, Abstand, Einbahnstraßen, Hysterese). Bei parallelen Straßen ohne klaren Favoriten gilt die Zuordnung als unsicher.
3. **Pfadvorhersage:** Der Straße wird ~600 m voraus (und 80 m zurück) gefolgt. An Kreuzungen ohne klare Weiterfahrt (Gabelung, Kreisverkehr) **endet die Vorhersage**, dahinter wird nichts angesagt. Bei gleicher Straßennummer bzw. gleichem Namen zählt die durchgehende Straße als Weiterfahrt.
4. **Kurven:** dieselbe Erkennung wie bei geplanten Routen (`detectCurvesXY`), dieselbe Kurvengrafik mit Fahrlinie, dieselben Ansagen. Kurven am Pfadende (unvollständig) und bei unsicherer Zuordnung werden nicht angesagt.
5. **Aufzeichnung und Auswertung:** Die Fahrt wird aufgezeichnet. Danach vergleicht die App die angesagten Kurven mit denen der tatsächlich gefahrenen Spur (Genauigkeit, Trefferquote, Falschmeldungen).

**Gemessen** (Simulation entlang der GPX-Fixtures, Straßendaten echt aus OSM; Regressionstests unter `test/freeride`):

| Strecke | Ansagen richtig | Kurven bis Stufe 4 erkannt |
| --- | --- | --- |
| Amalfi (6,6 km) | 99 % (76 von 77) | 97 % (70 von 72) |
| Stelvio (5,9 km) | 85 % (33 von 39) | 71 % (24 von 34) |

Das sind Entwicklungswerte mit dem GPX-Track als Wahrheit, **keine Aussage über echte Fahrten**. Bei Stelvio läuft der Track teils über Nebenstraßen, dort endet die Vorhersage oft an Kreuzungen (die App schweigt). Bekannte Schwächen:

- Ist die OSM-Geometrie gröber als die echte Straße (z. B. Spitzkehren), wird die Stufe zu mild eingeschätzt (gemessen: Spitzkehre mit R 7 m als „Rechts 4" vorhergesagt).
- Braucht Internet; ohne Daten zeigt die App „Keine Straßendaten".
- Ob die Positionen eines echten Fahrzeugs (GPS-Rauschen, Tunnel, Latenz) genauso gut passen, ist **noch nicht auf einer echten Fahrt geprüft**.

**Testfahrt:** Freie Fahrt → „Fahrt starten (GPS)" (als Beifahrer, nicht während der Fahrt bedienen). Nach „Beenden" erscheint die Auswertung. Zum Entwickeln gibt es „Simulation entlang einer importierten Route" (simuliertes GPS, echte OSM-Daten).

Straßendaten © OpenStreetMap-Mitwirkende (ODbL); die Quellenangabe steht in der App. Plan und Hintergründe: `docs/freeride-overpass-spike.md`.

## Nicht im MVP

Eigenes Routing, Accounts/Backend, Integration fremder Navi-Apps. (Freie Fahrt ohne Route: siehe oben, als Versuch umgesetzt.)

## Bundle-ID

`com.hackerload.cornerguider` (iOS und Android), Expo-Slug `cornerguider`.
