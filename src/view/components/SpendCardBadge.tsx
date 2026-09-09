import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../theme/ThemeProvider';
import { useTypography } from '../theme/TypographyProvider';
import { fonts } from '../theme/tokens';

/**
 * Purpose: quiet “paid with” chip on Money spend rows when a card is assigned.
 * Inputs: card display name.
 * Outputs: card-outline + name row (≥44pt hit area friendly when wrapped in a pressable parent).
 * Side effects: none.
 * Design decisions: presentation only — no balance math; girlfriend-simple tracker badge.
 *   Label size follows useTypography so Appearance text-size presets reach Money rows.
 */
export function SpendCardBadge({ name }: { name: string }) {
  const colors = useThemeColors();
  const { scaleFontSize } = useTypography();
  const size = scaleFontSize(13);
  return (
    <View style={styles.row} accessibilityLabel={name}>
      <Ionicons name="card-outline" size={Math.min(16, size + 1)} color={colors.muted} accessible={false} />
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
  },
  label: {
    fontFamily: fonts.body,
    flexShrink: 1,
  },
});
