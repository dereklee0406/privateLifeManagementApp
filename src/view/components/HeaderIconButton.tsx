import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hapticLight } from '../../utils/haptics';
import type { TypeIconName } from '../icons/typeIcons';
import { useThemeColors } from '../theme/ThemeProvider';
import { raisedSurface } from '../theme/tokens';

interface HeaderIconButtonProps extends Omit<PressableProps, 'children' | 'accessibilityLabel' | 'style'> {
  icon: TypeIconName;
  /** VoiceOver / TalkBack label (e.g. Keep, Add, Save). */
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Purpose: header trailing/leading primary chrome — Keep, Add, Done as a raised SF icon.
 * Inputs: Ionicons name, accessibility label, press props.
 * Outputs: ≥44pt accent-soft neumorph chip (matches Calendar day-head / Home actions).
 * Side effects: light haptic unless disabled; then onPress.
 * Design decisions: label is a11y-only so titles stay centered; disabled dims the chip.
 */
export function HeaderIconButton({
  icon,
  accessibilityLabel,
  disabled,
  onPress,
  style,
  ...rest
}: HeaderIconButtonProps) {
  const colors = useThemeColors();
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={(event) => {
        if (disabled) {
          return;
        }
        void hapticLight();
        onPress?.(event);
      }}
      style={[
        raisedSurface(colors, 14),
        styles.hit,
        { backgroundColor: colors.accentSoft, opacity: disabled ? 0.4 : 1 },
        style,
      ]}
    >
      <Ionicons name={icon} size={22} color={colors.accent} accessible={false} importantForAccessibility="no" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
