import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AppConfig } from '../config/appConfig';
import { shouldRequestNotificationPermission } from '../model/reminders/notificationPermission';

export interface ReminderNotificationFire {
  reminderId: string;
  index: number;
  title: string;
  body: string;
  fireAt: Date;
  url: string;
}

let playReminderSound = true;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: playReminderSound,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Purpose: OS local notifications exist on Android/iOS.
 * Inputs: none.
 * Outputs: true.
 * Side effects: none.
 */
export function reminderNotificationsSupported(): boolean {
  return true;
}

/**
 * Purpose: apply You → Customize sound to the next schedule and to in-app banners.
 * Inputs: true = default system sound; false = silent.
 * Outputs: none.
 * Side effects: module flag used by the notification handler and DATE content.
 * Design decisions: lives only in this native file so web Metro never evaluates expo-notifications sound APIs.
 */
export function setReminderNotificationSound(enabled: boolean): void {
  playReminderSound = enabled;
}

/**
 * Purpose: read the current OS notification grant without showing a dialog.
 * Inputs: none.
 * Outputs: true when alerts are already allowed.
 * Side effects: none (getPermissionsAsync only).
 * Design decisions: cold start and foreground resync use this so Halo never prompts on launch.
 */
export async function hasReminderPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  return permissionGranted(existing);
}

/**
 * Purpose: create Android channels then ask for POST_NOTIFICATIONS / iOS alert permission.
 * Inputs: none.
 * Outputs: true when the OS grants alerts.
 * Side effects: permission prompt only when not already granted; Android channel create.
 * Design decisions: channel is created first so Android 13 shows the permission dialog; we do not prompt at app launch unless a reminder is being scheduled.
 */
export async function requestReminderPermission(): Promise<boolean> {
  await ensureReminderChannels();
  const existing = await Notifications.getPermissionsAsync();
  if (permissionGranted(existing)) {
    return true;
  }
  const settings = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return permissionGranted(settings);
}

/**
 * Purpose: pick check-only vs prompt for a schedule sync.
 * Inputs: trigger from ReminderController (userEnable vs launch/sound/restore).
 * Outputs: true when the OS will show banners.
 * Side effects: requestPermissionsAsync only for userEnable; otherwise getPermissionsAsync.
 */
export async function ensureReminderPermission(
  trigger: Parameters<typeof shouldRequestNotificationPermission>[0],
): Promise<boolean> {
  if (shouldRequestNotificationPermission(trigger)) {
    return requestReminderPermission();
  }
  return hasReminderPermission();
}

function permissionGranted(settings: Notifications.NotificationPermissionsStatus): boolean {
  if (settings.granted) {
    return true;
  }
  const iosStatus = settings.ios?.status;
  return (
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

/**
 * Purpose: replace Halo reminder DATE notifications with the computed upcoming window.
 * Inputs: fire list from ReminderController; playSound from AppSettings.
 * Outputs: none.
 * Side effects: cancels previous halo.reminder.* requests; schedules DATE triggers with default sound or silent.
 * Design decisions: one-shot DATE fires from Model math — native repeating APIs cannot express every-N rules.
 *   Android uses a second silent channel because channel sound cannot change after create.
 */
export async function syncReminderNotifications(
  fires: ReminderNotificationFire[],
  playSound: boolean = true,
): Promise<void> {
  playReminderSound = playSound;
  await ensureReminderChannels();
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    existing
      .filter((item) => item.identifier.startsWith(AppConfig.reminders.idPrefix))
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
  const now = Date.now();
  const channelId = playSound ? AppConfig.reminders.channelId : AppConfig.reminders.silentChannelId;
  await Promise.all(
    fires
      .filter((fire) => fire.fireAt.getTime() > now)
      .map((fire) =>
        Notifications.scheduleNotificationAsync({
          identifier: `${AppConfig.reminders.idPrefix}${fire.reminderId}.${fire.index}`,
          content: {
            title: fire.title,
            body: fire.body,
            data: { url: fire.url },
            sound: playSound ? 'default' : false,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: fire.fireAt,
            channelId,
          },
        }),
      ),
  );
}

async function ensureReminderChannels(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  await Notifications.setNotificationChannelAsync(AppConfig.reminders.channelId, {
    name: 'Halo reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180, 120, 180],
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync(AppConfig.reminders.silentChannelId, {
    name: 'Halo reminders (silent)',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180, 120, 180],
    sound: null,
  });
}
