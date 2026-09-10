import { SettingsScreen } from '@/view/screens/SettingsScreen';

/**
 * Purpose: hidden tab route for Settings (href: null). Prefer root `/settings` from Insights.
 * Inputs: none.
 * Outputs: SettingsScreen when deep-linked as `/(tabs)/settings`.
 * Side effects: none.
 */
export default function SettingsTabRoute() {
  return <SettingsScreen />;
}
