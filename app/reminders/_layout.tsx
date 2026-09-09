import { Stack } from 'expo-router';

/**
 * Purpose: nested stack for reminder list, editor, and credit-card editor.
 */
export default function RemindersLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
