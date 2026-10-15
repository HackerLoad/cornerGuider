# Store-Texte (Entwurf)

> Entwurf. Die Texte müssen zum tatsächlichen Stand der App passen, **nichts versprechen, was nicht geprüft ist** (siehe `docs/website-brief.md`, Abschnitt „Was man nicht behaupten darf").

## App Store (iOS)

- **Name:** cornerGuider
- **Untertitel (max. 30 Zeichen):** Die nächste Kurve im Blick
- **Kategorie:** Navigation (Alternative: Reisen). Sekundär: Sport.
- **Altersfreigabe:** 4+ (keine bedenklichen Inhalte). Hinweis auf Nutzung nur als Ergänzung im Straßenverkehr im Text.
- **Schlüsselwörter (max. 100 Zeichen):** Motorrad,Kurven,Kurvenwarner,GPX,Landstraße,Pässe,Ansage,Tour,Kurviger,Rallye

**Beschreibung**

cornerGuider zeigt und sagt dir während der Fahrt die nächste Kurve an – ohne Navigation, ohne Karte im Fahrmodus. Importiere deine geplante Tour als GPX-Datei, z. B. aus Kurviger oder Calimoto, und die App berechnet alle Kurven der Strecke.

• Ansage „In 240 Metern Rechts 3, zieht zu, danach links 4" – über Lautsprecher oder Bluetooth-Headset, Musik wird leiser statt gestoppt
• Große Kurvengrafik aus den echten Koordinaten, mit Gegenspur und Fahrlinie in der eigenen Spur
• Kurvenstufen 1–6 (1 = Spitzkehre), bewusst vorsichtig eingestuft
• Leichte Kurven nur, wenn sie direkt auf eine angesagte folgen – einstellbar
• Hochformat und Querformat, dunkle Anzeige mit großem Kontrast, Live-Aktivität auf dem Sperrbildschirm
• Funktioniert ohne Konto und ohne Netz, deine Daten bleiben auf dem Gerät
• Freie Fahrt (Versuch): Kurven auch ohne geplante Route, aus OpenStreetMap-Daten vorhergesagt

**Wichtig:** Die Kurvendaten können ungenau sein. cornerGuider gibt keine Geschwindigkeitsempfehlung. Der tatsächliche Straßenverlauf hat immer Vorrang. Bedienung nur im Stand.

**Hinweise für die App-Review**

- Standort „Immer": notwendig, damit die Kurvenansagen auch bei gesperrtem Display im Hintergrund funktionieren (Hintergrundmodi `location` und `audio`).
- Testzugang: keiner nötig. Zum Testen die Simulation verwenden (Strecke importieren → Strecke öffnen → „Simulation starten"), dafür ist kein GPS nötig.
- Die Freie Fahrt sendet den ungefähren Standort an einen Overpass-Server (OpenStreetMap), siehe Datenschutzerklärung.

**App-Datenschutz („Privacy Nutrition Label")**

- Standort (genau): wird nur für Funktionen der App verwendet, nicht mit der Identität verknüpft, nicht zum Tracking. (Freie Fahrt: Übertragung an Overpass-Server.)
- Keine Kontaktdaten, keine Nutzungsdaten, keine Kennungen, keine Diagnosedaten.

## Google Play (Android)

- **Kurzbeschreibung (max. 80 Zeichen):** Sagt dir die nächste Kurve an – ohne Navigation, direkt aus deiner GPX-Tour.
- **Beschreibung:** wie oben (ohne „Live-Aktivität auf dem Sperrbildschirm").
- **Kategorie:** Karten & Navigation (oder Reisen & Lokales).
- **Datensicherheit:** Standort wird erhoben (App-Funktionalität), nicht geteilt – Ausnahme Freie Fahrt (Abruf von Straßendaten).
- **Standort im Hintergrund:** Play verlangt eine Erklärung und ein kurzes Video, das zeigt, wofür der Hintergrundstandort gebraucht wird (Ansagen bei gesperrtem Display).
- **Vordergrunddienst (Typ Standort):** Begründung: „Fahrmodus, der Kurven ansagt, solange die Fahrt läuft."

## Screenshots (zu erstellen)

Hochformat und Querformat, je mindestens: Fahrmodus mit Kurvengrafik, Routenübersicht (Kurvenliste), Go-Startseite, Einstellungen, Auswertung der Freien Fahrt. Gerätegrößen laut App Store Connect (6,9″/6,5″) bzw. Play Console. Aufnahmen aus der Simulation mit einer bekannten Strecke (Amalfi, Stelvio).
