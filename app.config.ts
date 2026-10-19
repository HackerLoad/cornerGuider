import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'cornerGuider',
  slug: 'cornerguider',
  scheme: 'cornerguider',
  version: '0.1.0',
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  extra: {
    // Straßendaten der Freien Fahrt (siehe docs/road-data-backend.md). Im Release ROAD_DATA_URL setzen und
    // ROAD_DATA_ALLOW_PUBLIC=false, damit die App nicht auf die öffentlichen Overpass-Server ausweicht.
    roadData: {
      url: process.env.ROAD_DATA_URL ?? '',
      allowPublic: process.env.ROAD_DATA_ALLOW_PUBLIC !== 'false',
      contact: process.env.ROAD_DATA_CONTACT ?? 'https://github.com/HackerLoad/cornerGuider',
      maxRequestsPerMinute: Number(process.env.ROAD_DATA_MAX_PER_MINUTE ?? 30),
    },
  },
  ios: {
    bundleIdentifier: 'com.hackerload.cornerguider',
    buildNumber: '1',
    supportsTablet: false,
    infoPlist: {
      UIBackgroundModes: ['location', 'audio'],
      // Die App nutzt keine eigene Verschlüsselung (nur HTTPS des Systems): erspart die Exportnachfrage beim Upload
      ITSAppUsesNonExemptEncryption: false,
      LSSupportsOpeningDocumentsInPlace: false,
      CFBundleDocumentTypes: [
        {
          CFBundleTypeName: 'GPX',
          LSHandlerRank: 'Alternate',
          LSItemContentTypes: ['com.topografix.gpx'],
        },
      ],
      UTImportedTypeDeclarations: [
        {
          UTTypeIdentifier: 'com.topografix.gpx',
          UTTypeDescription: 'GPS Exchange Format',
          UTTypeConformsTo: ['public.xml'],
          UTTypeTagSpecification: {
            'public.filename-extension': ['gpx'],
            'public.mime-type': ['application/gpx+xml'],
          },
        },
      ],
      NSLocationWhenInUseUsageDescription:
        'cornerGuider braucht deinen Standort, um die nächste Kurve auf der Route anzuzeigen.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'cornerGuider braucht den Standort auch im Hintergrund, damit Kurvenansagen bei gesperrtem Display funktionieren.',
    },
  },
  android: {
    package: 'com.hackerload.cornerguider',
    versionCode: 1,
    adaptiveIcon: {
      // Farbe des dunklen Himmels im Logo (scripts/make-app-icons.py), damit der Rand der Vordergrundebene nicht auffällt
      backgroundColor: '#10151a',
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    intentFilters: [
      {
        action: 'VIEW',
        category: ['DEFAULT', 'BROWSABLE'],
        data: [
          { scheme: 'content', mimeType: 'application/gpx+xml' },
          { scheme: 'content', mimeType: 'application/octet-stream' },
          { scheme: 'content', mimeType: 'text/xml' },
          { scheme: 'content', mimeType: 'application/xml' },
          { scheme: 'file', mimeType: 'application/gpx+xml' },
        ],
      },
    ],
    // Aus der Vorlage übernommene, nicht benötigte Rechte (im Play-Store-Review erklärungsbedürftig)
    blockedPermissions: [
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
    ],
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        // Dunkles Ladebild mit dem Logo (kein weißer Blitz vor der dunklen Oberfläche)
        backgroundColor: '#0b0d0f',
        image: './assets/splash-icon.png',
        imageWidth: 180,
        resizeMode: 'contain',
      },
    ],
    'expo-dev-client',
    [
      'expo-sensors',
      {
        // Bewegungssensor für die Schräglage-Aufzeichnung (Kalibrierung); die Daten bleiben auf dem Gerät
        motionPermission:
          'cornerGuider nutzt die Bewegungssensoren, um die Schräglage für die Kalibrierung aufzuzeichnen. Die Daten bleiben auf dem Gerät.',
      },
    ],
    './plugins/withLiveActivityFrequentUpdates',
    'expo-live-activity',
    [
      'expo-location',
      {
        isAndroidForegroundServiceEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isIosBackgroundLocationEnabled: true,
      },
    ],
  ],
};

export default config;
