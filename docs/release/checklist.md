# Checkliste bis zur Beta und zum Release

Vieles hier hängt von Entscheidungen ab, die noch offen sind (Namen, Konten, Zeitplan). Der Stand der App wird sich noch ändern.

## Einmalig

- [ ] **Apple Developer Program** (99 USD/Jahr), Bundle-ID `com.hackerload.cornerguider` registrieren; Team in Xcode wählen
- [ ] **Google Play Console** (einmalig 25 USD), App anlegen, Package `com.hackerload.cornerguider`
- [ ] **EAS**: `npm i -g eas-cli`, `eas login`, `eas build:configure` (nutzt die vorhandene `eas.json`)
- [ ] **Impressum / Verantwortlicher** und **Datenschutzerklärung** auf einer öffentlichen URL (Entwurf: `privacy-policy-draft.md`)
- [ ] Supportadresse oder -seite

## Vor jedem Build

- [ ] `npm test`, `npm run typecheck`, `npx expo-doctor`
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

## Noch offen im Projekt (siehe README)

- Android wurde noch nie gebaut oder auf einem Gerät gestartet (Ducking der Musik, Hintergrund-Ortung ungeprüft)
- Splash-Screen und Android-Icons sind konfiguriert, aber noch nicht auf einem Gerät gesehen
- Feedback wird nur per Export weitergegeben (kein Server); die Auswertung ist Handarbeit
- Android-Benachrichtigungsrecht (`POST_NOTIFICATIONS`, Android 13+) für die Dienst-Benachrichtigung wird noch nicht angefragt
- Entscheidung, ob die Freie Fahrt in der ersten Version dabei ist (öffentliche Overpass-Server sind zeitweise überlastet; es gibt jetzt Offline-Kacheln und einen eigenen Server, die Last auf öffentlichen Servern bleibt aber ein Thema für den Release)
