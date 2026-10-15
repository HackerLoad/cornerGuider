import * as Speech from 'expo-speech';
import type { DriveSettings } from '../settings';
import { currentDriveSettings } from '../stores/settingsStore';
import { beginDuck, endDuck } from './ducking';

const LOCALE = { de: 'de-DE', en: 'en-US' } as const;

export interface Voice {
  identifier: string;
  name: string;
  language: string;
  quality: string;
}

/** Spricht mit den aktuellen Einstellungen (Sprache, Stimme, Tempo). Eine neue Ansage ersetzt eine laufende. */
export function speakWithSettings(text: string, settings: DriveSettings = currentDriveSettings()): void {
  Speech.stop();
  beginDuck();
  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    endDuck();
  };
  Speech.speak(text, {
    language: LOCALE[settings.voiceLanguage],
    voice: settings.voiceId ?? undefined,
    rate: settings.speechRate,
    pitch: 1,
    useApplicationAudioSession: false, // iOS: eigene Sitzung, Musik wird automatisch gedämpft
    onDone: finish,
    onStopped: finish,
    onError: finish,
  });
}

export function stopSpeaking(): void {
  Speech.stop();
}

/** Auf dem Gerät installierte Stimmen der Sprache, beste Qualität zuerst. */
export async function voicesFor(language: 'de' | 'en'): Promise<Voice[]> {
  try {
    const all = await Speech.getAvailableVoicesAsync();
    return all
      .filter((v) => v.language.toLowerCase().startsWith(language))
      .map((v) => ({ identifier: v.identifier, name: v.name, language: v.language, quality: String(v.quality) }))
      .sort((a, b) => (a.quality === b.quality ? a.name.localeCompare(b.name) : a.quality === 'Enhanced' ? -1 : 1));
  } catch {
    return [];
  }
}
