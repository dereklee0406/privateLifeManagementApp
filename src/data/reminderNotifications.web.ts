import type { NotificationPermissionTrigger } from '../model/reminders/notificationPermission';

export interface ReminderNotificationFire {
  reminderId: string;
  index: number;
  title: string;
  body: string;
  fireAt: Date;
  url: string;
}

/**
 * Purpose: web cannot deliver OS notifications.
 * Inputs: none.
 * Outputs: false.
 * Side effects: none.
 * Design decisions: no expo-notifications import so Metro web never evaluates the native module.
 */
export function reminderNotificationsSupported(): boolean {
  return false;
}

/**
 * Purpose: web stub — Customize sound is persisted in settings only.
 */
export function setReminderNotificationSound(_enabled: boolean): void {
  return;
}

/**
 * Purpose: web permission stub — no dialog, no grant.
 */
export async function hasReminderPermission(): Promise<boolean> {
  return false;
}

/**
 * Purpose: web permission stub.
 */
export async function requestReminderPermission(): Promise<boolean> {
  return false;
}

/**
 * Purpose: web never prompts; schedule stays a local no-op.
 */
export async function ensureReminderPermission(
  _trigger: NotificationPermissionTrigger,
): Promise<boolean> {
  return false;
}

/**
 * Purpose: web no-op scheduler — reminders still persist locally.
 */
export async function syncReminderNotifications(
  _fires: ReminderNotificationFire[],
  _playSound?: boolean,
): Promise<void> {
  return;
}
