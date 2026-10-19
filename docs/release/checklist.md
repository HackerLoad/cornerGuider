# Checkliste bis zur Beta und zum Release

Vieles hier hängt von Entscheidungen ab, die noch offen sind (Namen, Konten, Zeitplan). Der Stand der App wird sich noch ändern.

## Grundregel: Store-Builds nur aus EAS-Cloud-Builds

> **Uploads nach App Store Connect (TestFlight und Release) kommen ausschließlich aus EAS-Cloud-Builds. Nie aus einem lokalen Build mit Xcode 16.4, auch nicht mit `eas build --local` und nicht per Xcode „Archive“.**

Grund: Seit dem 28.04.2026 nimmt App Store Connect nur Builds an, die mit Xcode 26 / iOS-26-SDK gebaut wurden. Lokal ist nur Xcode 16.4 installiert (Intel-Mac, siehe README). Lokale Builds dienen nur zum Entwickeln und für Tests im Simulator oder auf dem eigenen Gerät.

- `eas.json`: Die Profile `preview` und `production` setzen für iOS `"image": "latest"`, damit die Cloud das neueste Build-Image nimmt. Ein Test (`test/release/easConfig.test.ts`) hält das fest. **Ob „latest“ heute wirklich Xcode 26 ist, ist nicht geprüft**: Nach dem ersten Cloud-Build im Build-Log die Xcode-Version nachsehen. Ist sie älter als 26, ein ausdrückliches Image aus der EAS-Dokumentation eintragen.
- `ios/` und `android/` stehen in `.gitignore`. Dadurch sieht EAS ein verwaltetes Projekt und führt `expo prebuild` selbst in der Cloud aus. **Nie** `ios/` oder `android/` einchecken, sonst überspringt EAS den Prebuild und baut den alten Stand.
- Es zählt der eingecheckte Stand (EAS lädt getrackte Dateien hoch). Vor dem Build committen.

## Einmalig

- [ ] **Apple Developer Program** (99 USD/Jahr), Bundle-ID `com.hackerload.cornerguider` registrieren; Team in Xcode wählen
- [ ] **Google Play Console** (einmalig 25 USD), App anlegen, Package `com.hackerload.cornerguider`
- [ ] **EAS**: Konto anlegen, `npm i -g eas-cli` (oder `npx eas-cli@latest`), `eas login`, `eas whoami` zur Kontrolle, `eas build:configure` (nutzt die vorhandene `eas.json`)
- [ ] **iOS-Zertifikate für beide Ziele:** App `com.hackerload.cornerguider` **und** die Live-Aktivität `com.hackerload.cornerguider.LiveActivity` brauchen je ein Provisioning Profile. EAS legt sie beim ersten Build an, wenn man das Apple-Konto anmeldet (`eas credentials -p ios` zur Kontrolle). Für interne Verteilung (`preview`) zusätzlich Testgeräte registrieren: `eas device:create`.
- [ ] **Impressum / Verantwortlicher** und **Datenschutzerklärung** auf einer öffentlichen URL (Entwurf: `privacy-policy-draft.md`)
- [ ] Supportadresse oder -seite

## Befehle (nicht ausgeführt)

Diese Befehle lösen Cloud-Builds aus. Dafür braucht es ein EAS-Konto, die Anmeldung und je nach Plan Bezahlung; Claude Code hat sie deshalb **nicht** ausgeführt. Syntax vor dem ersten Einsatz mit `eas build --help` bzw. der aktuellen EAS-Dokumentation abgleichen.

```
# Einmalig: Umgebungsvariablen für den Produktionsbuild (siehe Abschnitt „Straßendaten“)
eas env:create --environment production --name ROAD_DATA_URL --value https://DEIN-SERVER/api/interpreter --visibility plaintext

# Interner Test (Entwicklung/Abnahme)
eas build --platform ios --profile preview          # Ad-hoc, nur registrierte Geräte
eas build --platform android --profile preview      # APK zum Direktinstallieren

# Release-Kandidaten (Store)
eas build --platform ios --profile production
eas build --platform android --profile production   # AAB

# Hochladen
eas submit --platform ios --profile production --latest
eas submit --platform android --profile production --latest
```

`eas submit` für iOS braucht in `eas.json` unter `submit.production.ios` später die `ascAppId` (noch nicht eingetragen). Für Android braucht die erste Veröffentlichung einen manuell hochgeladenen Build in der Play Console und einen Service-Account-Schlüssel (`serviceAccountKeyPath`); beides ist noch offen.

## Straßendaten der Freien Fahrt im Release

- Das Profil `production` setzt `ROAD_DATA_ALLOW_PUBLIC=false`: Die App weicht im Release **nicht** auf die öffentlichen Overpass-Server aus.
- Ohne eigenen Server (`ROAD_DATA_URL`) zeigt die Freie Fahrt im Release „Kein Straßendaten-Server eingerichtet“. Entscheidung offen: Entweder die Freie Fahrt kommt in Version 1 mit eigenem Backend (siehe `docs/road-data-backend.md`) oder sie wird für den Release ausgeblendet. Dafür gibt es noch keinen Schalter in der App.
- Datenschutzerklärung (Entwurf) nennt noch die öffentlichen Server; auf den tatsächlichen Dienst anpassen.

## Vor jedem Build

- [ ] `npm test`, `npm run typecheck`, `npx expo-doctor`
- [ ] Alles committet (`git status` sauber), `ios/` und `android/` nicht eingecheckt
- [ ] Version in `app.config.ts` (`version`), Build-Nummern erhöht EAS (`autoIncrement`)
- [ ] Echte Fahrt geprüft: Hintergrund-Ortung, Bluetooth-Headset, Ducking (iOS und Android), Akkuverbrauch

## iOS (TestFlight)

1. `eas build -p ios --profile production`
2. `eas submit -p ios` (oder die `.ipa` mit Transporter hochladen)
3. In App Store Connect: App anlegen, Datenschutzangaben (siehe Store-Texte), Exportkonformität (ist gesetzt: `ITSAppUsesNonExemptEncryption = false`), Testgruppe einladen
4. Bei der Review: Begründung für „Standort immer" und Hinweis auf die Simulation zum Testen

## Android (interner Test)

1. `eas build -p android --profile production` (AAB)
2. `eas submit -p android`, anfangs im **internen Test**
3. Play Console: Datensicherheit, Standort-Hintergrunderklärung mit Video, Vordergrunddienst-Typ „Standort"

## Live-Aktivität im Cloud-Build (Prüfung vom 19.10.2026)

Geprüft wurde, ob das Ziel `LiveActivity` allein aus dem Repo entsteht, wie es in der EAS-Cloud geschieht (dort gibt es nur eingecheckte Dateien und einen frischen Prebuild).

**Vorgehen:** `git archive HEAD` in ein leeres Verzeichnis entpacken (nur getrackte Dateien, ohne `ios/`/`android/`), `node_modules` des lokalen Projekts verlinken, `npx expo prebuild --platform ios --clean --no-install` ausführen. Das Ergebnis:

- Das Ziel `LiveActivity` entsteht: `ios/LiveActivity/` mit den Swift-Dateien aus dem Paket `expo-live-activity` (0.4.2), der Entitlements-Datei, der `Info.plist` und `Assets.xcassets`.
- Alle 15 Bilder aus `assets/liveActivity/` (12 Kurven, `finish`, `gps`, `offroute`) landen als `*.imageset` im Ziel. Sie sind eingecheckt; das Plugin liest sie relativ zum Projektordner (`./assets/liveActivity`), in EAS ist das der Projektstamm.
- In der Haupt-`Info.plist` stehen `NSSupportsLiveActivities = true` und `NSSupportsLiveActivitiesFrequentUpdates = true`. Das Letztere kommt aus unserem Plugin `plugins/withLiveActivityFrequentUpdates.js` (das Paket setzt `false`); der Prebuild liefert `true`.
- Bundle-ID des Ziels: `com.hackerload.cornerguider.LiveActivity`. Das Plugin trägt es in `extra.eas.build.experimental.ios.appExtensions` ein, damit EAS die Zertifikate für die Erweiterung verwaltet.
- **Keine von Hand angelegten Dateien nötig:** Es liegt nichts Natives im Repo außer Plugin-Code und den Bildern.

**Nicht geprüft** (nur ein echter Cloud-Build zeigt das): ob der Xcode-26-Build die Swift-Dateien von `expo-live-activity` 0.4.2 fehlerfrei übersetzt; ob EAS die Provisioning Profile für beide Ziele anlegen kann; ob die Cloud mit `npm ci` dieselben Paketversionen wie die lokale Installation bekommt (die Prüfung lief mit der lokalen `node_modules`, nicht mit einer frischen Installation aus `package-lock.json`); wie sich die Live-Aktivität auf einem Gerät verhält.

## Noch offen im Projekt (siehe README)

- Android wurde noch nie gebaut oder auf einem Gerät gestartet (Ducking der Musik, Hintergrund-Ortung ungeprüft)
- Splash-Screen und Android-Icons sind konfiguriert, aber noch nicht auf einem Gerät gesehen
- Feedback wird nur per Export weitergegeben (kein Server); die Auswertung ist Handarbeit
- Android-Benachrichtigungsrecht (`POST_NOTIFICATIONS`, Android 13+) für die Dienst-Benachrichtigung wird noch nicht angefragt (Aufgabe A8 der Review-Runde)
- Entscheidung, ob die Freie Fahrt in der ersten Version dabei ist (im Produktionsprofil sind die öffentlichen Overpass-Server gesperrt; ohne eigenes Backend funktioniert die Freie Fahrt im Release nicht, siehe oben)
