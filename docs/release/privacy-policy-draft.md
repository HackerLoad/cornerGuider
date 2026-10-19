# Datenschutzerklärung (Entwurf)

> Entwurf, kein Rechtsrat. Vor der Veröffentlichung von einer fachkundigen Person prüfen lassen und Name, Anschrift und Kontakt des Verantwortlichen eintragen.

**Verantwortlicher:** _[Name, Anschrift, E-Mail]_

## Kurzfassung

cornerGuider hat kein Benutzerkonto, keine Werbung und kein Tracking. Streckendaten und Einstellungen bleiben auf deinem Gerät. Nur die **Freie Fahrt** schickt Positionsdaten an einen externen Dienst (siehe unten).

## Welche Daten verarbeitet die App?

| Daten | Wofür | Wo | Weitergabe |
| --- | --- | --- | --- |
| **Standort** (GPS, auch im Hintergrund) | Kurven auf deiner Strecke ansagen und anzeigen | nur auf dem Gerät | keine, außer bei der Freien Fahrt |
| **GPX-Dateien** und berechnete Kurven | Strecken speichern | nur auf dem Gerät | keine |
| **Einstellungen** | Ansagen, Anzeige, Einheiten | nur auf dem Gerät | keine |
| **Aufzeichnungen der Freien Fahrt** (Positionen mit Zeit, Geschwindigkeit, GPS-Genauigkeit, Ansagen) | Auswertung der Fahrt | nur auf dem Gerät | keine, außer durch deinen Export (siehe unten) |
| **Bewegungssensor** (Schwerkraftrichtung des Handys, daraus die Neigung) | Schräglage der Fahrt für die Verbesserung der Kurvenstufen aufzeichnen | nur auf dem Gerät, Teil der Aufzeichnung | keine, außer durch deinen Export |

## Freie Fahrt: Abruf von Straßendaten

Für die Freie Fahrt lädt die App Straßendaten von **OpenStreetMap** über öffentliche Overpass-Server (derzeit `overpass.openstreetmap.fr`, ersatzweise `overpass-api.de` und `maps.mail.ru`). **Entwurfshinweis:** Für den Release ist ein eigener Server bzw. vorberechnete Kacheln vorgesehen (siehe `docs/road-data-backend.md`); dieser Absatz muss dann auf den tatsächlich genutzten Dienst angepasst werden. Die App sendet einen eindeutigen User-Agent (`cornerGuider/<Version>`) und begrenzt die Anfragen pro Minute. Dabei wird **der ungefähre Standort** (Mittelpunkt eines Kreises von 1,5 km Radius um deine Position, auf 6 Nachkommastellen) an diesen Server gesendet. Der Server erhält technisch bedingt deine IP-Adresse. Es werden keine Namen, Gerätekennungen oder Konten übertragen. Die Betreiber der Server verarbeiten die Anfragen nach eigenen Datenschutzhinweisen.

Die Freie Fahrt wird nur gestartet, wenn du sie selbst auswählst. Bei Fahrten mit geplanter Strecke werden keine Positionsdaten übertragen.

## Aufzeichnung und Export (Entwurf, neu)

> Entwurf: Dieser Abschnitt beschreibt die geplante Aufzeichnung für die Kalibrierung und ist noch nicht geprüft.

- Bei der Freien Fahrt speichert die App für jede Fahrt eine Aufzeichnung: Positionen mit Zeitstempel, GPS-Geschwindigkeit und -Genauigkeit, den berechneten Kurvenradius, die rechnerische Schräglage und, falls das Gerät einen Bewegungssensor hat, die Richtung der Schwerkraft und die daraus berechnete Neigung. Dazu die angesagten Kurven und deine Bewertungen.
- Die Aufzeichnung bleibt auf deinem Gerät. Die App sendet sie nicht an uns oder Dritte und wertet sie nicht selbst aus.
- Ein Export (GPX oder JSON) findet **nur statt, wenn du ihn selbst in der Ergebnisansicht der Fahrt auslöst**. Wohin du die Datei teilst, entscheidest du. Die Aufzeichnung enthält deine gefahrene Strecke mit Uhrzeiten und lässt Rückschlüsse auf Wohnort und Gewohnheiten zu; teile sie nur mit Personen, denen du vertraust.
- **Offen:** Die App hat derzeit keine Funktion, einzelne Aufzeichnungen zu löschen (`deleteRecording` existiert im Code, ist aber in keiner Ansicht eingebunden). Aktuell sind alle Aufzeichnungen erst mit dem Löschen der App entfernt. Vor einem Release entweder eine Löschfunktion ergänzen oder diesen Text so lassen.
- Der Bewegungssensor wird nur während einer Freien Fahrt gelesen.

## Berechtigungen

- **Standort „immer"**: damit die Ansagen auch bei gesperrtem Display und im Hintergrund weiterlaufen. Du kannst den Zugriff jederzeit in den Systemeinstellungen ändern.
- **Bewegung (Bewegungssensor)**: damit die Neigung des Handys während der Freien Fahrt aufgezeichnet werden kann. Auf iOS steht dafür ein Nutzungstext in der App; die Abfrage ist nicht nötig, wenn nur der Beschleunigungssensor gelesen wird. Ob und wann das System fragt, ist nicht geprüft.
- **Datei-Zugriff** nur für die GPX-Dateien, die du selbst auswählst oder teilst.
- **Live-Aktivität (iOS)**: zeigt die nächste Kurve auf dem Sperrbildschirm; die Daten verlassen das Gerät nicht.

## Speicherdauer und Löschen

Alle Daten liegen lokal. Strecken kannst du in der App löschen. Einzelne Aufzeichnungen der Freien Fahrt lassen sich derzeit nicht in der App löschen (siehe Abschnitt „Aufzeichnung und Export"); mit dem Löschen der App werden alle Daten entfernt.

## Deine Rechte

Die App selbst erhebt keine personenbezogenen Daten auf eigenen Servern und speichert keine auf deine Kosten außerhalb deines Geräts; es gibt daher bei uns nichts, worüber Auskunft erteilt oder was gelöscht werden könnte. Für Fragen zum Abruf der Straßendaten wende dich an den Verantwortlichen oder die Betreiber der genannten Server.

## Sicherheitshinweis

Die Kurvendaten können ungenau sein. Die App gibt keine Geschwindigkeitsempfehlung; der tatsächliche Straßenverlauf, Sicht, Wetter, Fahrbahn und Verkehr haben immer Vorrang.

## Datenquellen

Straßendaten der Freien Fahrt: © OpenStreetMap-Mitwirkende, Lizenz ODbL.
