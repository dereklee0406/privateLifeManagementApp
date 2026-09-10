import { Tabs } from 'expo-router';
import { FloatingTabBar } from '@/view/components/FloatingTabBar';
import { useI18n } from '@/view/i18n';

/**
 * Purpose: five-tab shell with a floating glass island instead of a system tab bar.
 * Inputs: Expo Router tab routes.
 * Outputs: tab navigator (Today, Pages, Rhythm, Money, Insights). Settings is href:null; open via `/settings`.
 * Side effects: none.
 */
export default function TabsLayout() {
  const { t } = useI18n();
  return (
    <Tabs
      tabBar={(props) => (
        <FloatingTabBar state={props.state} navigation={props.navigation as never} />
      )}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.today') }} />
      <Tabs.Screen name="journal" options={{ title: t('tabs.pages') }} />
      <Tabs.Screen name="calendar" options={{ title: t('tabs.rhythm') }} />
      <Tabs.Screen name="money" options={{ title: t('tabs.money') }} />
      <Tabs.Screen name="insights" options={{ title: t('tabs.insights') }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings'), href: null }} />
    </Tabs>
  );
}
