import { Stack } from 'expo-router';

/**
 * Purpose: nested stack for Goal create/edit from Rhythm Focus.
 */
export default function GoalsLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
