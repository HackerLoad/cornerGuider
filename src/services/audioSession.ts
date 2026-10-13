import { setAudioModeAsync } from 'expo-audio';

/** Musik anderer Apps wird geduckt statt gestoppt; Ansagen laufen auch bei gesperrtem Display. */
export async function configureAudioSession(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'duckOthers',
    shouldPlayInBackground: true,
    shouldRouteThroughEarpiece: false,
  });
}
