# cornerGuider

Cross-Platform-App (iOS + Android) für Motorradfahrer. Sie zeigt und sagt während der Fahrt die **nächste Kurve** auf einer geplanten GPX-Route an – nur Kurven, keine Abbiegehinweise, keine Karte.

- Oben: „In 240 m: Rechts 3"
- Darunter: große Kurvengrafik, aus den echten Koordinaten gerendert, in Fahrtrichtung nach oben
- Darunter: die nächsten Kurven als kompakte Liste
- Sprachansagen über Lautsprecher oder Bluetooth-Headset sind der Hauptkanal, das Display ergänzt

> **Sicherheit:** Die Kurvendaten werden aus GPX-Dateien berechnet und können ungenau sein. Die App gibt keine Geschwindigkeitsempfehlung. Der tatsächliche Straßenverlauf hat immer Vorrang. Beim ersten Start muss ein Sicherheitshinweis bestätigt werden.

## Status

MVP-Funktionen sind implementiert, aber **noch nicht auf einem Gerät getestet** (geprüft sind Unit-Tests, Typecheck und der JS-Bundle-Export).

| Bereich | Stand |
| --- | --- |
| Kurvenerkennung (`src/curves`) + CLI | fertig, getestet |
| GPX-Import, Speicherung, Routenliste, Kurvenübersicht | fertig, nicht auf Gerät getestet |
| Tracker (Snapping, Off-Route, Latenzausgleich) | fertig, getestet |
| Fahrmodus, Kurvengrafik, Sprachansagen, Hintergrund-Ortung | fertig, nicht auf Gerät getestet |
| Simulationsmodus | fertig, getestet |

Bekannte offene Punkte:

- **Musik ducken:** iOS-Audio-Session ist auf `duckOthers` gesetzt. Auf Android fordert `expo-speech` vermutlich keinen Audio-Fokus an – falls die Musik nicht leiser wird, ist ein kleines natives Modul nötig.
- **Kurvenstufen:** Die Schwellwerte in `src/curves/config.ts` sind Schätzwerte und noch nicht an echten Fahrten kalibriert.
- **Kurvengrafik:** Das Layout (v. a. die Position der Stufenzahl) ist noch nicht auf einem Gerät gesehen.
- **Dateiimport:** Dateiauswahl, „Öffnen mit"/Teilen und iOS-Dokumenttyp sind noch nicht auf einem Gerät geprüft.

## Stack

Expo SDK 57 (Development Build, kein Expo Go) · React Native · TypeScript (strict) · expo-router · Zustand · expo-location + expo-task-manager · expo-speech + expo-audio · react-native-svg · expo-file-system · Jest

## Entwicklung

Voraussetzungen: Node, für iOS Xcode, für Android Android Studio mit einem virtuellen Gerät.

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
test/                    Jest-Tests, GPX-Fixtures unter test/fixtures
```

Schichten: `UI → stores → services → core (reines TS)`. Die Kernlogik hat keine React-Native-Abhängigkeiten und ist deshalb komplett per Jest und CLI testbar.

## Daten

- Importierte Routen liegen als JSON im Dokumentenordner der App (inkl. vorberechneter Kurven und Kurvengeometrie), der Index in AsyncStorage. Kein Backend, keine Accounts.
- **GPX-Hinweis:** Verwende Tracks oder dicht gepunktete Routen. Dateien mit nur wenigen Wegpunkten (Ø > 100 m Abstand) liefern ungenaue Kurven; die App warnt beim Import.
- Test-Fixtures (`test/fixtures`): Tracks aus [gpx-rider/gpx-rider.github.io](https://github.com/gpx-rider/gpx-rider.github.io) (MIT-Lizenz).

## Nicht im MVP

Eigenes Routing, Freifahrt ohne Route, Accounts/Backend, Integration fremder Navi-Apps.

## Bundle-ID

`com.hackerload.cornerguider` (iOS und Android), Expo-Slug `cornerguider`.
