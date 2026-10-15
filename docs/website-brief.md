# cornerGuider – Briefing für die Website

Dieses Dokument beschreibt, was die App kann und was nicht. Es ist für jemanden gedacht, der die App auf einer Website vorstellen soll. **Bitte nichts versprechen, was hier nicht steht.**

## Worum geht es

cornerGuider ist eine App für Motorradfahrer (iOS und Android, Deutsch). Sie sagt während der Fahrt **die nächste Kurve** an und zeigt sie groß an, zum Beispiel „In 240 m: Rechts 3". Es gibt **keine Navigation und keine Abbiegehinweise**, im Fahrmodus auch keine Karte. Die Ansage per Sprache ist der Hauptkanal (Lautsprecher oder Bluetooth-Headset), das Display ergänzt sie.

Name: cornerGuider · Bundle-ID `com.hackerload.cornerguider` · Repo (privat): `HackerLoad/cornerGuider` · lokal: `/Users/maxim/Desktop/GitHub/ios-android/cornerGuider`

## Was die App kann

**Routen**
- GPX-Dateien importieren (Track oder Route, z. B. Export aus Kurviger oder Calimoto) über Dateiauswahl oder „Öffnen mit"/Teilen.
- Beim Import werden alle Kurven der Strecke **offline vorberechnet**. Es braucht kein Netz und kein Konto.
- Routenübersicht: Liste aller Kurven mit Richtung, Stufe, Radius, Winkel, Länge, Form (zieht zu / öffnet) und Entfernung ab Start. Warnungen bei zu dünnen GPX-Dateien.

**Kurvenerkennung**
- Aus den echten Koordinaten: Radius, Richtung, Gesamtwinkel, Länge, ob sich die Kurve zuzieht oder öffnet.
- Einstufung nach **Rallye-Skala 1–6** (1 = Spitzkehre, 6 = sehr leicht), bewusst konservativ: im Zweifel enger eingestuft.
- Kurvenfolgen werden erkannt und als eine Ansage zusammengefasst („Rechts 3, danach links 4").

**Fahrmodus**
- Dunkel, sehr großer Kontrast, große Schrift, keine Bedienung nötig, Bildschirm bleibt an. Hoch- und **Querformat** (Handy quer am Lenker).
- Oben „In 240 m: Rechts 3" (immer einzeilig). Darunter eine **Kurvengrafik** aus den echten Koordinaten: zweispurige Straße mit Gegenspur und Mittellinie, der Kurvenabschnitt in der Farbe der Stufe, große Stufenzahl, dazu eine **Fahrlinie** innerhalb der eigenen Spur (außen – Scheitel innen – außen, Scheitel später bei zugehenden Kurven). Darunter die nächsten Kurven als Liste.
- Die Entfernung wird **entlang der Route** gemessen, nicht in Luftlinie. Die Position wird auf die Route gelegt, springt nie rückwärts und wird um die GPS-Latenz korrigiert.
- Erkennt, wenn man von der Route abkommt (über 50 m, länger als 5 s), und zeigt das klar an, statt falsche Kurven zu melden.

**Sprachansagen**
- Vorwarnzeit abhängig von der Geschwindigkeit (Standard 6 s, mindestens 80 m), einstellbar. Jede Kurve wird einmal angesagt. Beispiele: „In 240 Metern Rechts 3, zieht zu", „In 100 Metern Spitzkehre links".
- Musik anderer Apps soll geduckt statt gestoppt werden (siehe Grenzen).

**Akku und Hintergrund**
- Ortung läuft auch bei gesperrtem Display, im Stand wird sparsamer geortet.

**Simulation**
- Eine Fahrt entlang einer importierten Route abspielen, mit einstellbarer Geschwindigkeit, Pause, Vorspringen und künstlicher Abweichung. Zum Testen ohne Motorrad und für Demo-Videos.

**Sicherheitshinweis**
- Beim ersten Start muss bestätigt werden: Daten können ungenau sein, keine Geschwindigkeitsempfehlung, der tatsächliche Straßenverlauf hat immer Vorrang, die Fahrlinie ist nur ein geometrischer Vorschlag.

## Freie Fahrt (experimentell)

Ohne geplante Route: Die App sagt den Straßenverlauf aus **OpenStreetMap**-Daten (Overpass-API) voraus und meldet die Kurven davor. Sie ordnet die Position der Straße zu, folgt ihr ~600 m voraus und **hört an unklaren Kreuzungen auf** (Gabelung, Kreisverkehr). Dahinter schweigt sie. Die Fahrt wird aufgezeichnet und danach automatisch mit der tatsächlich gefahrenen Spur verglichen (Genauigkeit, Trefferquote, Falschmeldungen).

Gemessen (Simulation entlang der Test-GPX, Straßendaten echt aus OSM):

| Strecke | Ansagen richtig | Kurven bis Stufe 4 erkannt |
| --- | --- | --- |
| Amalfi (6,6 km) | 99 % (76 von 77) | 97 % (70 von 72) |
| Stelvio (5,9 km) | 85 % (33 von 39) | 71 % (24 von 34) |

Erste echte Testfahrt (Beifahrer im Auto, 0,9 km): 7 von 7 Ansagen richtig, 5 von 5 echten Kurven erkannt. **Das ist eine kleine Stichprobe und kein Gütesiegel.**

## Was man NICHT behaupten darf

- Nicht „getestet auf dem Motorrad": Bisher nur im iOS-Simulator und bei einer kurzen Autofahrt (Freie Fahrt). Die App ist **noch nicht im App Store oder bei Google Play**. Es gibt nur einen Entwicklungs-Build.
- Android wurde noch **nie gebaut oder gestartet**, nur der JavaScript-Export wurde geprüft.
- Nicht „sicher", „genau" oder „fehlerfrei". Die Kurvendaten können ungenau sein, und die Freie Fahrt kann an Kreuzungen falsch liegen.
- Keine Geschwindigkeitsempfehlung und keine Aussage, wie schnell man eine Kurve fahren kann. Die Stufe beschreibt nur die Enge.
- Nicht „Navigation", „Kartenansicht" oder „Routenplanung" – das gibt es bewusst nicht.
- Offen und **nicht geprüft**: Ducking der Musik auf Android (vermutlich geht es dort noch nicht), Hintergrund-Ortung und Bluetooth-Headset auf einem echten Gerät, Verhalten bei Tunneln und schlechtem GPS.
- Die Stufen-Schwellwerte sind geschätzt und noch nicht an echten Fahrten kalibriert.
- Die Freie Fahrt braucht Internet (öffentliche Overpass-Server, zeitweise überlastet). Ist die OSM-Geometrie gröber als die Straße, wird die Stufe zu mild eingeschätzt.

## Technik (für Entwickler-Abschnitt)

Expo SDK 54 / React Native 0.81, TypeScript (strict), expo-router, Zustand, expo-location, expo-speech, react-native-svg. Die gesamte Kernlogik (Geometrie, GPX, Kurvenerkennung, Tracking, Ansagen, Freie Fahrt) ist **reines TypeScript ohne React-Native-Abhängigkeit** und hat 104 Jest-Tests, auch gegen echte GPX-Tracks und echte OSM-Daten. Dadurch läuft sie auch im Browser: Eine **Web-Demo** („GPX hochladen, Kurven und Grafik ansehen") wäre ohne Server möglich, die Daten blieben auf dem Gerät. Das wäre eine gute Idee für die Website.

## Material und Rechtliches

- Logo: `assets/icon.png` (1024×1024). Screenshots aus dem iOS-Simulator liegen lokal unter `ios/Simulator Screenshot …png` (der Ordner steht nicht im Git); neue Screenshots am besten von Amalfi oder Stelvio: Fahrmodus Hoch- und Querformat, Routenübersicht, Kurvengrafik, Auswertung der Freien Fahrt.
- Straßendaten der Freien Fahrt: © OpenStreetMap-Mitwirkende (ODbL). **Die Quellenangabe muss überall stehen, wo diese Funktion gezeigt wird.**
- Test-GPX (`test/fixtures`) stammen aus `gpx-rider/gpx-rider.github.io` (MIT-Lizenz); bei Verwendung auf der Website die Quelle nennen.
- Das Repo ist privat. Quellcode oder interne Dateien nicht ohne Rückfrage veröffentlichen.

## Vorschläge für die Website

- Kernbotschaft: „Zeigt und sagt dir die nächste Kurve an – ohne Navigation."
- Zeigen: Kurvengrafik mit Fahrlinie, Fahrmodus im Querformat, Routenübersicht, Sprachansage-Beispiele.
- Ehrlicher Status („in Entwicklung, Beta-Test bald") statt Store-Links; ggf. Warteliste oder Kontakt.
- Hinweis auf Sicherheit gut sichtbar, wie in der App.

Offene Fragen an den Besitzer: Soll die Website Deutsch oder zweisprachig sein? Gibt es einen Zeitplan für TestFlight/Play-Store-Beta? Darf eine Web-Demo gebaut werden?
