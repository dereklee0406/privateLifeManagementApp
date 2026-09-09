import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';
import { hapticLight } from '../../utils/haptics';
import { useThemeColors } from '../theme/ThemeProvider';
import { type } from '../theme/typography';

interface TextButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  tone?: 'accent' | 'muted' | 'danger';
}

/**
 * Purpose: iOS plain-text control for secondary actions (Cancel, More details, Remove).
 * Inputs: label, optional tone, standard pressable props.
 * Outputs: 44pt text button. Primary filled actions stay on PrimaryButton.
 * Side effects: light haptic unless disabled; then onPress.
 */
export function TextButton({ label, tone = 'accent', disabled, onPress, ...rest }: TextButtonProps) {
  const colors = useThemeColors();
  const color = tone === 'danger' ? colors.danger : tone === 'muted' ? colors.muted : colors.accent;
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPress={(event) => {
        if (disabled) {
          return;
        }
        void hapticLight();
        onPress?.(event);
      }}
      accessibilityRole="button"
      style={[styles.hit, { opacity: disabled ? 0.4 : 1 }]}
    >
      <Text style={[type.headline, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
});
