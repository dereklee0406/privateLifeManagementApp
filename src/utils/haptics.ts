import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

let hapticsEnabled = true;

/**
 * Purpose: honor You → Customize haptics without every View reading settings.
 * Inputs: true = fire; false = no-op.
 * Outputs: none.
 * Side effects: module flag read by hapticLight / hapticSuccess / hapticBoundary.
 */
export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabled = enabled;
}

/**
 * Purpose: fire a light haptic when the platform supports it and Customize is on.
 * Inputs: none (reads module flag).
 * Outputs: Promise that resolves after the haptic request.
 * Side effects: triggers device vibration/haptic engine; no-ops on web or when off.
 * Design decisions: wrap Expo haptics so Views never import the SDK directly in many places.
 */
export async function hapticLight(): Promise<void> {
  if (!hapticsEnabled || Platform.OS === 'web') {
    return;
  }
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/**
 * Purpose: signal a control bound was reached (e.g. day stepper at 1 or 31).
 * Inputs: none (reads module flag).
 * Outputs: Promise that resolves after the haptic request.
 * Side effects: warning notification haptic on native when Customize is on; no-op on web/off.
 * Design decisions: distinct from hapticLight so users feel a soft “stop” instead of another tick.
 */
export async function hapticBoundary(): Promise<void> {
  if (!hapticsEnabled || Platform.OS === 'web') {
    return;
  }
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

/**
 * Purpose: confirm a successful write (save) when haptics are on.
 */
export async function hapticSuccess(): Promise<void> {
  if (!hapticsEnabled || Platform.OS === 'web') {
    return;
  }
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}
