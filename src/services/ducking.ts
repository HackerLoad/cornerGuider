import { Platform } from 'react-native';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

/**
 * Android: expo-speech fordert keinen Audio-Fokus an, die Musik anderer Apps liefe daher in voller
 * Lautstärke weiter. Solange gesprochen wird, hält deshalb ein stilles Audiosignal den Fokus
 * (Modus „duckOthers", siehe audioSession.ts). iOS dämpft über `useApplicationAudioSession: false` von selbst.
 */
const SILENCE = require('../../assets/sounds/silence.wav');

let player: AudioPlayer | null = null;
let holds = 0;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

export function beginDuck(): void {
  if (Platform.OS !== 'android') return;
  holds++;
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = null;
  try {
    if (!player) {
      player = createAudioPlayer(SILENCE);
      player.loop = true;
    }
    if (!player.playing) player.play();
  } catch {
    // Ducking ist eine Zugabe: ohne sie wird trotzdem gesprochen
  }
}

/** Fokus erst kurz nach dem Ende der Ansage wieder abgeben, damit die Musik nicht zwischen zwei Sätzen aufblitzt. */
export function endDuck(delayMs = 400): void {
  if (Platform.OS !== 'android') return;
  holds = Math.max(0, holds - 1);
  if (holds > 0) return;
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => {
    try {
      player?.pause();
    } catch {
      // ignorieren
    }
  }, delayMs);
}
