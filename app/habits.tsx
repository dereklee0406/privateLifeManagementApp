import { Redirect } from 'expo-router';

/**
 * Purpose: legacy `/habits` deep link — land on Rhythm Consistency segment inside Tab 3.
 * Inputs: none.
 * Outputs: redirect into the calendar (rhythm) tab with `tab=streaks`.
 * Side effects: replace navigation so FloatingTabBar stays visible.
 */
export default function HabitsRoute() {
  return <Redirect href="/(tabs)/calendar?tab=streaks" />;
}
