import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hapticLight } from '../../utils/haptics';
import type { TypeIconName } from '../icons/typeIcons';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, raisedSurface } from '../theme/tokens';

interface SectionActionButtonProps extends Omit<PressableProps, 'children' | 'accessibilityLabel' | 'style'> {
  /** SF-style Ionicons glyph shown beside the label. */
  icon: TypeIconName;
  /** Visible + default VoiceOver label. */
  label: string;
  /** Override when the visible label is abbreviated. */
  accessibilityLabel?: string;
  /** `accent` = peach chip (default); `muted` = quieter secondary chrome. */
  tone?: 'accent' | 'muted';
  style?: StyleProp<ViewStyle>;
}

/**
 * Purpose: section-header / inline list action as a tactile neumorph chip (icon + label).
 * Inputs: Ionicons name, visible label, optional tone, standard press props.
 * Outputs: ≥44pt raised accent-soft (or muted) chip matching Home / Calendar clay chrome.
 * Side effects: light haptic unless disabled; then onPress.
 * Design decisions: replaces raw peach text links in Money headers; label can shrink so
 *   long locales do not shove the section title; icon is decorative for a11y.
 */
export function SectionActionButton({
  icon,
  label,
  accessibilityLabel,
  tone = 'accent',
  disabled,
  onPress,
  style,
  ...rest
}: SectionActionButtonProps) {
  const colors = useThemeColors();
  const ink = tone === 'muted' ? colors.muted : colors.accent;
  const fill = tone === 'muted' ? colors.surface : colors.accentSoft;
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
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
        { backgroundColor: fill, opacity: disabled ? 0.4 : 1 },
        style,
      ]}
    >
      <View style={styles.row}>
        <Ionicons name={icon} size={18} color={ink} accessible={false} importantForAccessibility="no" />
        <Text style={[styles.label, { color: ink }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 0,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    flexShrink: 1,
  },
});
