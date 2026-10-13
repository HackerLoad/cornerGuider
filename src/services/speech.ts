import * as Speech from 'expo-speech';

/** Neue Ansage ersetzt eine noch laufende (veraltete Kurve nicht zu Ende sprechen). */
export function speak(text: string, rate = 1): void {
  Speech.stop();
  Speech.speak(text, { language: 'de-DE', rate, pitch: 1 });
}

export function stopSpeaking(): void {
  Speech.stop();
}
