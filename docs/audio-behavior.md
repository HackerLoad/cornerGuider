# Audio und Ortung neben anderen Apps

Stand: Review-Runde 2026-10. **Alles hier ist aus dem Quellcode von cornerGuider, `expo-speech` und `expo-audio` (SDK 54) gelesen. Nichts davon wurde auf einem Gerät mit einer Navi-App geprüft.** Die Prüfung steht in `docs/test-protocol-navi.md` aus.

## Was die App tut

| Stelle | Verhalten |
| --- | --- |
| `src/services/audioSession.ts` | `setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers', shouldPlayInBackground: true, shouldRouteThroughEarpiece: false })`, aufgerufen beim Öffnen beider Fahrmodi |
| `src/services/speech.ts` | Jede Ansage: `Speech.stop()` (bricht eine laufende eigene Ansage ab), `beginDuck()`, dann `Speech.speak(…, { useApplicationAudioSession: false })`; am Ende `endDuck()` |
| `src/services/ducking.ts` | Nur Android: ein stilles, endlos wiederholtes Audiosignal (`assets/sounds/silence.wav`) hält den Audio-Fokus, solange gesprochen wird, und noch 400 ms danach |
| `app.config.ts` | iOS `UIBackgroundModes`: `location`, `audio` |

Die App erkennt nicht, ob eine andere App gerade spricht. Sie wartet nicht, sondern spricht, sobald eine Kurve fällig ist.

## iOS

- `expo-audio` setzt die Sitzung auf Kategorie `.playback` mit Option `.duckOthers` (`AudioModule.swift`). Aktiviert wird sie erst, wenn ein Player spielt oder aktiv geschaltet wird. Die App spielt unter iOS keinen Player ab (das Stille-Signal ist nur Android). Ob die Sitzung deshalb unter iOS überhaupt aktiv wird, ist **ungeklärt**.
- Die Sprachausgabe läuft mit `useApplicationAudioSession: false`. Dann nutzt `AVSpeechSynthesizer` seine eigene, vom System verwaltete Sitzung. Nach Apples Beschreibung senkt das System dabei die Lautstärke anderer Audioinhalte während der Ansage („dämpfen“). **Quelle ist die Beschreibung des Parameters in `expo-speech`, nicht ein Gerätetest.**
- Wer wen dämpft: cornerGuider dämpft Musik und Navi-Ansagen während der eigenen Ansage. Ob eine Navi-App ihrerseits cornerGuider dämpft oder stoppt, hängt von deren Sitzungseinstellungen ab und ist nicht bekannt.
- Spricht die Navi-App gerade, während eine Kurve fällig ist, sprechen beide gleichzeitig. Es gibt keine Warteschlange und keine Abstimmung. Die eigene Ansage kann nicht erkennen, dass die andere läuft.

## Android

- `expo-speech` fordert **keinen** Audio-Fokus an (im Quellcode bestätigt). Deshalb hält `ducking.ts` den Fokus über einen stillen Player. `expo-audio` fordert für den Modus `duckOthers` `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK` an (`AudioModule.kt`) und gibt ihn ab, wenn kein Player mehr spielt.
- Folge: Andere Apps, die auf Fokus reagieren (Musik), werden gedämpft oder pausiert, solange cornerGuider spricht.
- Eine Navi-App, die selbst `…MAY_DUCK` anfordert und gerade spricht, bekommt von Android `AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK` und entscheidet selbst, ob sie leiser wird. Die Sprachausgabe von cornerGuider läuft unabhängig vom Fokus weiter, auch wenn der Fokus verloren geht. Sie kann also über die Navi-Ansage hinwegsprechen.
- `AUDIOFOCUS_LOSS_TRANSIENT` (z. B. Anruf) pausiert das stille Signal; die Ansage selbst wird davon nicht gestoppt.

## Ortung und Akku

- Gestartet wird mit `Accuracy.BestForNavigation`, 1 s Intervall, `activityType: AutomotiveNavigation`, Hintergrund-Updates über einen Vordergrunddienst (Android) bzw. Hintergrundstandort (iOS).
- **Zwei Apps orten gleichzeitig.** Die Systeme teilen sich die Standortdaten zwar (ein GPS-Chip), die Last durch zwei Apps mit höchster Genauigkeit und die Anzeige „Standort wird verwendet“ lassen sich aber nicht aus dem Code beurteilen. Der Akkuverbrauch ist **nicht gemessen**.
- Neu in dieser Runde: Auch die Freie Fahrt schaltet nach 20 s Stand auf sparsames Orten (`balanced`, 3 s, 5 m) und bei Bewegung sofort zurück. Die geplante Route tat das schon. Beide nutzen jetzt `GpsAdapter` (`src/tracking/adaptiveGps.ts`).
- **Bewusst nicht gedrosselt:** In Fahrt bleibt es bei 1 Hz mit bester Genauigkeit. Die Vorschau der Freien Fahrt und der Vorlauf (6 s bzw. mindestens 80 m) brauchen aktuelle Positionen; ein längeres Intervall würde Ansagen verspäten. Wie viel eine geschwindigkeitsabhängige Drosselung (z. B. 2 s bei langsamer Fahrt) sparen würde, ist nicht gemessen, daher unterbleibt sie.
- Beim Umschalten des Profils startet `DeviceLocationSource.setProfile` die Ortungsupdates neu (`halt`, dann `begin`). Das kann kurz Positionen kosten. Unter Android startet dabei der Vordergrunddienst neu (nicht geprüft).

## Kürzere Ansagen

- Einstellung **Kurze Ansagen** (Einstellungen › Ansagen): nur Richtung und Stufe, z. B. „Rechts 3“ statt „In 240 Metern Rechts 3, zieht zu“. Sie überstimmt den Stil und ändert ihn nicht.
- Deutlich zuziehende Kurven behalten im kurzen Modus „zieht zu“ (Schwelle `strongTighteningRatio`, siehe `config.ts`), weil das die wichtigste Warnung ist.
- „Kurve, unsicher“ und „Keine Vorschau“ sind ohnehin kurz.
- Ob kurze Ansagen neben einer Navi-App weniger stören, ist **nicht geprüft**.

## Offene Fragen (nur auf dem Gerät zu klären)

1. Aktiviert sich unter iOS die Sitzung mit `.duckOthers`, und dämpft cornerGuider eine laufende Navi-Ansage?
2. Dämpft oder stoppt eine Navi-App (Google Maps, Kurviger, Calimoto) cornerGuider?
3. Wie oft überlagern sich Ansagen auf einer 30-Minuten-Fahrt?
4. Wie viel zusätzlichen Akku kostet es, wenn beide Apps orten?
5. Läuft die Ansage über ein Bluetooth-Headset neben der Navi-Ansage hörbar getrennt?
6. Unter Android: Reicht das stille Signal, damit Musik gedämpft wird, und gibt die App den Fokus nach der Ansage wieder ab?
