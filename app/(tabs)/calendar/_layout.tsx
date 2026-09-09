import { Stack } from 'expo-router';

/**
 * Purpose: Calendar tab stack so the reminders list stays inside the five-tab shell.
 * Inputs: Expo Router stack children (month view, reminders list).
 * Outputs: nested stack; FloatingTabBar remains visible on the list.
 * Side effects: none.
 * Design decisions: list is a Calendar child (bar stays at five items). Create/edit stay on the root reminders stack as full-screen screens.
 */
export default function CalendarLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
