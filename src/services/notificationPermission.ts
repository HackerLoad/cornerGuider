import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import { t } from '../i18n';
import { ensureNotificationPermission, shouldWarn, type NotificationPermissionResult } from '../permissions/notifications';

const PERMISSION = 'android.permission.POST_NOTIFICATIONS' as const;

export function askNotificationPermission(): Promise<NotificationPermissionResult> {
  return ensureNotificationPermission({
    os: Platform.OS,
    apiLevel: Platform.Version,
    check: () => PermissionsAndroid.check(PERMISSION),
    request: () => PermissionsAndroid.request(PERMISSION),
  });
}

let warned = false;

/**
 * Vor dem Start des Fahrmodus (nicht in der Simulation): fragt unter Android 13+ das Benachrichtigungsrecht an.
 * Bei Ablehnung erscheint einmal pro App-Start ein Hinweis; der Fahrmodus startet trotzdem (der Hinweis blockiert nicht).
 */
export async function ensureNotifications(): Promise<NotificationPermissionResult> {
  const result = await askNotificationPermission();
  if (shouldWarn(result) && !warned) {
    warned = true;
    Alert.alert(t('notifPerm.title'), t('notifPerm.text'), [
      { text: t('common.ok'), style: 'cancel' },
      { text: t('notifPerm.settings'), onPress: () => void Linking.openSettings().catch(() => undefined) },
    ]);
  }
  return result;
}
