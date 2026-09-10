/**
 * Purpose: decide whether Halo may show the OS notification permission dialog.
 * Inputs: why a schedule sync is running.
 * Outputs: true only for an explicit user enable (new/on reminder), never cold start.
 * Side effects: none.
 * Design decisions: launch and foreground resync reuse an existing grant; Customize sound
 *   flips reschedule without asking again; restore must not surprise her with a prompt.
 */
export type NotificationPermissionTrigger =
  | 'userEnable'
  | 'coldStart'
  | 'foreground'
  | 'soundChange'
  | 'restore';

export function shouldRequestNotificationPermission(
  trigger: NotificationPermissionTrigger,
): boolean {
  return trigger === 'userEnable';
}
