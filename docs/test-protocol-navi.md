# Testprotokoll: cornerGuider neben einer Navigations-App

> **Status: NICHT DURCHGEFÜHRT.** Dieses Protokoll liegt bereit. Claude Code kann den Test nicht ausführen und hat ihn nicht als erledigt markiert. Ergebnisse trägt Max selbst ein.

Hintergrund und Annahmen: `docs/audio-behavior.md`. Alle dort genannten Verhaltensweisen sind bisher nur aus dem Quellcode gelesen.

## Vorbereitung (beide Plattformen)

- [ ] Aktueller Development-Build von cornerGuider (nach `npx expo prebuild --clean`)
- [ ] Navi-App mit Sprachführung (Google Maps, Kurviger oder Calimoto), Ziel gesetzt, Navigation gestartet
- [ ] Bluetooth-Headset oder Motorrad-Kommunikationssystem gekoppelt
- [ ] Musik-App spielt (zweiter Fall: ohne Musik)
- [ ] Akku vorher notieren: ____ %; Display-Helligkeit und Energiesparmodus notieren
- [ ] cornerGuider: Einstellungen › Ansagen auf Standard (Stil „Ausführlich“, Kurze Ansagen aus), Lautstärke so, dass beide Apps hörbar sind
- [ ] Auf einer Strecke testen, auf der die Navi-App regelmäßig spricht (Abbiegehinweise), mit Kurven für cornerGuider
- [ ] Zweite Person fährt oder die Fahrt erfolgt als Beifahrer bzw. im Auto. Auf dem Motorrad nur mit sicher montiertem Gerät und nicht bedienen während der Fahrt.

## Ablauf (je Plattform, mindestens 30 min Fahrt)

1. Navi-App starten, dann cornerGuider: **Freie Fahrt** (Variante A) bzw. importierte Route (Variante B) starten.
2. App im Hintergrund lassen, Display sperren; 30 min fahren.
3. Während der Fahrt (durch die Begleitperson) mitschreiben, siehe Tabelle.
4. Nach der Fahrt: Akku nachher notieren, Fahrt in cornerGuider auswerten.

Zwei Durchläufe: **A** Ausführlicher Stil, **B** Kurze Ansagen an. Jeweils zuerst mit Musik, dann ohne.

## Messwerte

| | iOS | Android |
| --- | --- | --- |
| Gerät / Systemversion | | |
| Navi-App und Version | | |
| Fahrtdauer (min) | | |
| Akku vorher / nachher (%) | | |
| Akkuverbrauch pro Stunde (%) – zum Vergleich: nur Navi-App, gleiche Strecke | | |
| Anzahl Ansagen cornerGuider | | |
| Anzahl Navi-Ansagen | | |
| Überlagerungen (beide sprechen gleichzeitig) | | |
| davon: eine Ansage unverständlich | | |

## Prüffragen

| # | Frage | iOS | Android |
|---|---|---|---|
| 1 | Wird die Navi-Ansage leiser, wenn cornerGuider spricht? | | |
| 2 | Wird cornerGuider leiser oder gestoppt, wenn die Navi-App spricht? | | |
| 3 | Wird die Musik während cornerGuider-Ansagen gedämpft und danach wieder laut? | | |
| 4 | Musik kommt nach der Ansage zwischen zwei Sätzen kurz hoch („aufblitzen“)? | | |
| 5 | Beide Ansagen über das Bluetooth-Headset getrennt hörbar? | | |
| 6 | Laufen cornerGuider-Ansagen bei gesperrtem Display weiter? | | |
| 7 | Brechen cornerGuider-Ansagen nach einigen Minuten ab (Hintergrund-Beschränkung)? | | |
| 8 | Zeigt das System „Standort wird verwendet“ für beide Apps? | | |
| 9 | Wird die Navi-App durch cornerGuider in ihrer Positionsgenauigkeit oder Aktualisierung gestört? | | |
| 10 | Wirkt der Kurzmodus entspannter (weniger Überlagerung)? | | |
| 11 | Android: Benachrichtigung des Vordergrunddienstes sichtbar, Dienst läuft die ganze Fahrt? | – | |
| 12 | Android: Ortung nach Rückkehr aus dem Standby noch aktiv? | – | |

## Überlagerungen notieren

| Uhrzeit / km | Navi sagte | cornerGuider sagte | Wer war lauter? | Verständlich? | Bemerkung |
| --- | --- | --- | --- | --- | --- |
| | | | | | |
| | | | | | |

## Auswertung (von Max auszufüllen)

- Hat sich bestätigt, was in `docs/audio-behavior.md` steht? Abweichungen:
- Reicht der aktuelle Ansatz (keine Abstimmung mit der Navi-App)? Wenn nein: Warteschlange, Pause bei laufender Fremdansage oder Verzicht auf Ansagen kurz vor Navi-Hinweisen prüfen.
- Akkuverbrauch akzeptabel?
- Datum, Fahrer, Strecke:
