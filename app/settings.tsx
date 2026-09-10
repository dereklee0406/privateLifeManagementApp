import { SettingsScreen } from '@/view/screens/SettingsScreen';

/**
 * Purpose: root stack route for Settings & Vault (pushed from Insights header).
 * Inputs: none.
 * Outputs: SettingsScreen with slide-from-right stack chrome.
 * Side effects: none.
 */
export default function SettingsRoute() {
  return <SettingsScreen />;
}
