import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { hapticLight } from '../../utils/haptics';
import { useThemeColors } from '../theme/ThemeProvider';
import { tabBarContentHeight } from '../theme/tokens';
import { type } from '../theme/typography';
import { useI18n } from '../i18n';
import { GlassSurface } from './GlassSurface';

interface TabDescriptor {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
}

const TAB_ICONS: Array<Omit<TabDescriptor, 'label'> & { labelKey: string }> = [
  { name: 'index', labelKey: 'tabs.today', icon: 'home-outline', iconFocused: 'home' },
  { name: 'journal', labelKey: 'tabs.pages', icon: 'book-outline', iconFocused: 'book' },
  { name: 'calendar', labelKey: 'tabs.calendar', icon: 'calendar-outline', iconFocused: 'calendar' },
  { name: 'money', labelKey: 'tabs.money', icon: 'card-outline', iconFocused: 'card' },
  { name: 'settings', labelKey: 'tabs.settings', icon: 'settings-outline', iconFocused: 'settings' },
];

interface TabRoute {
  key: string;
  name: string;
  state?: { index?: number };
}

interface FloatingTabBarProps {
  state: { index: number; routes: TabRoute[] };
  navigation: {
    emit: (event: {
      type: 'tabPress';
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: { screen: string }) => void;
  };
}

/**
 * Purpose: iOS-like tab bar shared by Android, iOS, and web.
 * Inputs: Expo Router tab bar props.
 * Outputs: edge-to-edge neumorph bar with five SF-style Ionicons + labels (Today, Pages, Calendar, Money, Settings).
 * Side effects: light haptic on tab change; navigation events.
 * Design decisions: not a Material FAB and not a floating island — HIG tab bar + Halo dual-shadow.
 *   Only names listed in TABS render. A second tap on the focused tab pops a nested stack.
 */
export function FloatingTabBar({ state, navigation }: FloatingTabBarProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <GlassSurface
        style={[
          styles.bar,
          {
            paddingBottom: Math.max(insets.bottom, 8),
            borderTopColor: colors.line,
          },
        ]}
        radius={0}
      >
        <View style={styles.row}>
          {state.routes.map((route, index) => {
            const descriptor = TAB_ICONS.find((tab) => tab.name === route.name);
            if (!descriptor) {
              return null;
            }
            const focused = state.index === index;
            const tint = focused ? colors.accent : colors.faint;
            const label = t(descriptor.labelKey);
            return (
              <Pressable
                key={route.key}
                onPress={() => {
                  void hapticLight();
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (event.defaultPrevented) {
                    return;
                  }
                  if (focused && (route.state?.index ?? 0) > 0) {
                    navigation.navigate(route.name, { screen: 'index' });
                    return;
                  }
                  if (!focused) {
                    navigation.navigate(route.name);
                  }
                }}
                style={styles.tab}
                accessibilityRole="button"
                accessibilityState={{ selected: focused }}
              >
                <Ionicons name={focused ? descriptor.iconFocused : descriptor.icon} size={25} color={tint} />
                <Text
                  style={[type.tabLabel, { color: tint }]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.2}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    minHeight: tabBarContentHeight,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 2,
    minHeight: 44,
  },
});
