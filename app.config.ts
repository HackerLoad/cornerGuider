import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'cornerGuider',
  slug: 'cornerguider',
  scheme: 'cornerguider',
  version: '0.1.0',
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  ios: {
    bundleIdentifier: 'com.hackerload.cornerguider',
    supportsTablet: false,
    infoPlist: {
      UIBackgroundModes: ['location', 'audio'],
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
    adaptiveIcon: {
      backgroundColor: '#000000',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
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
    'expo-dev-client',
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
