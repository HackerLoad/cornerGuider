import type { OrientationMode } from '../settings';

/**
 * Ausrichtung festhalten oder freigeben. `expo-screen-orientation` ist ein natives Modul: In einem Build ohne
 * das Modul wird der Aufruf still übergangen (die App dreht sich dann wie in app.config eingestellt).
 */
export async function applyOrientation(mode: OrientationMode): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SO = require('expo-screen-orientation') as typeof import('expo-screen-orientation');
    if (mode === 'auto') await SO.unlockAsync();
    else if (mode === 'portrait') await SO.lockAsync(SO.OrientationLock.PORTRAIT_UP);
    else await SO.lockAsync(SO.OrientationLock.LANDSCAPE);
  } catch {
    // Modul fehlt (alter Build) oder Plattform unterstützt es nicht
  }
}
