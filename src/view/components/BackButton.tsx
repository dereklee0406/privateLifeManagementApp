import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { hapticLight } from '../../utils/haptics';
import { leaveScreen } from '../../utils/navigation';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';

interface BackButtonProps {
  onPress?: PressableProps['onPress'];
  style?: StyleProp<ViewStyle>;
}

/**
 * Purpose: stack/modal chrome — leave the current page with an iOS Back chevron.
 * Inputs: optional onPress (defaults to leaveScreen); optional style for header balance.
 * Outputs: icon-only chevron-back (≥44pt hit). Screen readers hear common.back.
 * Side effects: light haptic when Customize haptics are on; pops the stack, or replaces Today when history is empty, unless onPress is supplied.
 * Design decisions: no visible “Back” label (VoiceOver only); no raised circle so it reads as nav chrome.
 */
export function BackButton({ onPress, style }: BackButtonProps) {
  const colors = useThemeColors();
  const router = useRouter();
  const { t } = useI18n();
  return (
    <Pressable
      onPress={(event) => {
        void hapticLight();
        if (onPress) {
          onPress(event);
          return;
        }
        leaveScreen(router);
      }}
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      hitSlop={8}
      style={[styles.hit, style]}
    >
      <Ionicons name="chevron-back" size={28} color={colors.accent} accessible={false} importantForAccessibility="no" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -6,
    // KeyboardDismissScrollView wraps children in a stretching Pressable; without this
    // the chevron centers across the full row width (looks like a floating mid-header).
    alignSelf: 'flex-start',
  },
});
