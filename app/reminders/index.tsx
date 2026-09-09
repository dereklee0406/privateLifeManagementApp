import { Redirect } from 'expo-router';

/**
 * Purpose: `/reminders` used to be a root stack screen and hid the tab island.
 * Inputs: none.
 * Outputs: send the list into Tab 3 Rhythm hub, where FloatingTabBar stays visible.
 * Side effects: replace navigation.
 */
export default function RemindersListRedirect() {
  return <Redirect href="/(tabs)/calendar" />;
}
