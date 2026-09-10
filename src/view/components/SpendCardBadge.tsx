import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../theme/ThemeProvider';
import { useTypography } from '../theme/TypographyProvider';
import { fonts } from '../theme/tokens';
import type { TypeIconName } from '../icons/typeIcons';

/**
 * Purpose: glanceable “how paid” chip on Money spend rows (card name or Cash).
 * Inputs: display name; optional Ionicons glyph (card-outline default, cash-outline for cash).
 * Outputs: icon + name row (≥44pt hit area friendly when wrapped in a pressable parent).
 * Side effects: none.
 * Design decisions: presentation only — no balance math; girlfriend-simple tracker badge.
 *   Label size follows useTypography so Appearance text-size presets reach Money rows.
 *   Uses `muted` (not `faint`) so secondary payment text meets list contrast.
 */
export function SpendCardBadge({ name, icon = 'card-outline' }: { name: string; icon?: TypeIconName }) {
  const colors = useThemeColors();
  const { scaleFontSize } = useTypography();
  const size = scaleFontSize(14);
  return (
    <View style={styles.row} accessibilityLabel={name}>
      <Ionicons name={icon} size={Math.min(16, size + 1)} color={colors.muted} accessible={false} />
      <Text
        style={[styles.label, { color: colors.muted, fontSize: size, lineHeight: Math.round(size * 1.35) }]}
        numberOfLines={1}
      >
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    minHeight: 18,
    flexShrink: 1,
    minWidth: 0,
  },
  label: {
    fontFamily: fonts.body,
    flexShrink: 1,
  },
});
