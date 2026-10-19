/** Ergebnis der Anfrage nach dem Benachrichtigungsrecht. */
export type NotificationPermissionResult = 'granted' | 'denied' | 'blocked' | 'notNeeded';

/** Umgebung (Plattform und Systemaufrufe), damit die Entscheidung ohne React Native testbar ist. */
export interface NotificationEnv {
  /** `Platform.OS` */
  os: string;
  /** `Platform.Version`: auf Android die API-Stufe (Zahl), auf iOS ein Text */
  apiLevel: number | string;
  check(): Promise<boolean>;
  request(): Promise<'granted' | 'denied' | 'never_ask_again'>;
}

/** Ab Android 13 (API 33) ist `POST_NOTIFICATIONS` ein Laufzeitrecht. */
export const ANDROID_13_API = 33;

/**
 * Fragt unter Android 13+ das Recht für Benachrichtigungen an (sie zeigen die Meldung des Vordergrunddienstes
 * für die Hintergrund-Ortung). Vorher gesetzte Rechte werden nicht erneut abgefragt. Fehler zählen als Ablehnung,
 * damit der Hinweis erscheint.
 */
export async function ensureNotificationPermission(env: NotificationEnv): Promise<NotificationPermissionResult> {
  if (env.os !== 'android' || Number(env.apiLevel) < ANDROID_13_API) return 'notNeeded';
  try {
    if (await env.check()) return 'granted';
  } catch {
    // Prüfung nicht möglich: trotzdem anfragen
  }
  try {
    const answer = await env.request();
    if (answer === 'granted') return 'granted';
    return answer === 'never_ask_again' ? 'blocked' : 'denied';
  } catch {
    return 'denied';
  }
}

/** Soll der Hinweis „Ortung im Hintergrund kann unzuverlässig sein" erscheinen? */
export function shouldWarn(result: NotificationPermissionResult): boolean {
  return result === 'denied' || result === 'blocked';
}
