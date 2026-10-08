import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Notification foundation. Product code must use this module, never expo-notifications directly.
 *
 * Phase 0M rules:
 * - Never request permission at launch. Ask in context later (Phase 5M/7M) with a primer screen.
 * - Do not create the Android channel at launch: on Android 13+ creating the first channel
 *   triggers the OS permission prompt.
 * - No push-token registration yet.
 */

export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

export const DEFAULT_ANDROID_CHANNEL_ID = 'default';

let handlerConfigured = false;

/** Foreground presentation policy. Safe to call at startup (no permission prompt). */
export function configureNotificationHandling(): void {
  if (handlerConfigured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  handlerConfigured = true;
}

function toPermission(status: Notifications.PermissionStatus): NotificationPermission {
  switch (status) {
    case Notifications.PermissionStatus.GRANTED:
      return 'granted';
    case Notifications.PermissionStatus.DENIED:
      return 'denied';
    default:
      return 'undetermined';
  }
}

/** Reads the current permission without prompting. */
export async function getNotificationPermission(): Promise<NotificationPermission> {
  const { status } = await Notifications.getPermissionsAsync();
  return toPermission(status);
}

/**
 * Prompts the user. Call ONLY from an explicit, in-context user action (not used in Phase 0M).
 * On Android the default channel must exist before the prompt can be shown.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(DEFAULT_ANDROID_CHANNEL_ID, {
      name: 'General',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return toPermission(status);
}
