import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hapticLight } from '../../utils/haptics';
import type { TypeIconName } from '../icons/typeIcons';
import { useThemeColors } from '../theme/ThemeProvider';
import { useTypography } from '../theme/TypographyProvider';
import { fonts, raisedAccent } from '../theme/tokens';

interface PrimaryButtonProps extends PressableProps {
  label: string;
  /** Optional leading SF-style Ionicons glyph (Keep / Save / Next). */
  icon?: TypeIconName;
  /** Shows a spinner and keeps the control disabled while a save is in flight. */
  busy?: boolean;
}

/**
 * Purpose: shared filled action used for save and onboarding continue.
 * Inputs: label, optional leading icon, optional busy, standard pressable props.
 * Outputs: softly raised clay pill (Halo), iOS-prominent primary at the bottom of a flow.
 * Side effects: light haptic on press when Customize haptics are on; then the supplied onPress.
 * Design decisions: icon is decorative; accessibilityLabel defaults to the visible label.
 *   Label size follows useTypography so Appearance text-size presets reach primary CTAs.
 */
export function PrimaryButton({
  label,
  icon,
  busy = false,
  disabled,
  onPress,
  accessibilityLabel,
  ...rest
}: PrimaryButtonProps) {
  const colors = useThemeColors();
  const { scaleFontSize } = useTypography();
  const blocked = Boolean(disabled || busy);
  const labelSize = scaleFontSize(17);
  return (
    <Pressable
      {...rest}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: blocked, busy }}
      onPress={(event) => {
        if (blocked) {
          return;
        }
        void hapticLight();
        onPress?.(event);
      }}
      style={({ pressed }) => [
        raisedAccent(colors, 22),
        styles.button,
        {
          opacity: blocked ? 0.45 : pressed ? 0.92 : 1,
          transform: [{ scale: pressed && !blocked ? 0.985 : 1 }],
        },
      ]}
    >
      <View style={styles.row}>
        {busy ? (
          <ActivityIndicator color={colors.accentInk} />
        ) : icon ? (
          <Ionicons name={icon} size={20} color={colors.accentInk} accessible={false} importantForAccessibility="no" />
        ) : null}
        <Text
          style={[
            styles.label,
            {
              color: colors.accentInk,
              fontSize: labelSize,
              lineHeight: Math.round(labelSize * 1.3),
            },
          ]}
          numberOfLines={2}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    minWidth: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minWidth: 0,
  },
  label: {
    fontFamily: fonts.bodySemi,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
});
