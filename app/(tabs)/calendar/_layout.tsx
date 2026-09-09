import { Stack } from 'expo-router';

/**
 * Purpose: Calendar tab stack so Rhythm (tasks + streaks) stays inside the five-tab shell.
 * Inputs: Expo Router stack children (Rhythm landing, legacy reminders alias).
 * Outputs: nested stack; FloatingTabBar remains visible on the hub.
 * Side effects: none.
 * Design decisions: folder name stays `calendar` for route stability; create/edit stay on the root reminders stack.
 */
export default function CalendarLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
