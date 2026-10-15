import { Platform } from 'react-native';
import { LiveThrottle, toLiveContent, type LiveContent, type LiveInput } from '../liveActivity/model';
import type { Lang } from '../i18n/translate';
import { translate } from '../i18n/translate';
import type { Units } from '../settings';

type LiveModule = typeof import('expo-live-activity');

let mod: LiveModule | null | undefined;

/** Natives Modul erst bei Bedarf laden: in einem Build ohne das Modul (oder auf Android) passiert still nichts. */
function native(): LiveModule | null {
  if (Platform.OS !== 'ios') return null;
  if (mod !== undefined) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-live-activity') as LiveModule;
  } catch {
    mod = null;
  }
  return mod;
}

const CONFIG = {
  backgroundColor: '#000000',
  titleColor: '#ffffff',
  subtitleColor: '#9aa4ad',
  progressViewTint: '#ffb300',
  progressViewLabelColor: '#ffffff',
  imagePosition: 'right',
  imageAlign: 'center',
  imageSize: { width: 72, height: 72 },
  contentFit: 'contain',
  padding: { horizontal: 18, vertical: 14 },
} as const;

let activityId: string | undefined;
let lastLang: Lang = 'de';
const throttle = new LiveThrottle(2000);

const toState = (c: LiveContent) => ({
  title: c.title,
  subtitle: c.subtitle || undefined,
  progressBar: c.progress === undefined ? undefined : { progress: c.progress },
  imageName: c.imageName,
  dynamicIslandImageName: c.imageName,
});

/** Zeigt die nächste Kurve auf Sperrbildschirm und Dynamic Island; startet die Aktivität beim ersten Aufruf. */
export function updateLiveActivity(input: LiveInput, units: Units, lang: Lang = 'de', now: number = Date.now()): void {
  const m = native();
  if (!m) return;
  const content = toLiveContent(input, units, lang);
  lastLang = lang;
  if (!throttle.shouldSend(content.key, now)) return;
  try {
    if (!activityId) activityId = m.startActivity(toState(content), CONFIG) ?? undefined;
    else m.updateActivity(activityId, toState(content));
  } catch {
    // Live-Aktivitäten sind eine Zugabe (z. B. in den iOS-Einstellungen abschaltbar): nie die Fahrt stören
  }
}

/** Beendet die Aktivität (Fahrt zu Ende oder Bildschirm verlassen). */
export function endLiveActivity(): void {
  const m = native();
  const id = activityId;
  activityId = undefined;
  throttle.reset();
  if (!m || !id) return;
  try {
    m.stopActivity(id, { title: translate(lastLang, 'live.ended'), subtitle: undefined, imageName: 'finish', dynamicIslandImageName: 'finish' });
  } catch {
    // ignorieren
  }
}
