import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'cornerGuider',
  slug: 'cornerguider',
  scheme: 'cornerguider',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  ios: {
    bundleIdentifier: 'com.hackerload.cornerguider',
    supportsTablet: false,
    infoPlist: {
      UIBackgroundModes: ['location', 'audio'],
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
      monochromeImage: './assets/android-icon-monochrome.png',
    },
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
