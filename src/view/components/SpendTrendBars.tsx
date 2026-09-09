import { StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

interface SpendTrendBarsProps {
  rows: Array<{ key: string; label: string; amount: number }>;
}

/**
 * Purpose: tiny spend trend without a chart library (web-safe Views).
 * Inputs: monthly amounts.
 * Outputs: equal-width bars scaled to the max month.
 * Side effects: none.
 */
export function SpendTrendBars({ rows }: SpendTrendBarsProps) {
  const colors = useThemeColors();
  const max = Math.max(1, ...rows.map((row) => row.amount));
  return (
    <View style={styles.row}>
      {rows.map((row) => (
        <View key={row.key} style={styles.col}>
          <View style={[styles.track, { backgroundColor: colors.well }]}>
            <View
              style={[
                styles.fill,
                { height: Math.max(4, Math.round((row.amount / max) * 64)), backgroundColor: colors.accent },
              ]}
            />
          </View>
          <Text style={[styles.label, { color: colors.faint }]}>{row.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', height: 88 },
  col: { flex: 1, alignItems: 'center', gap: 6, height: '100%' },
  track: { flex: 1, width: '70%', borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' },
  fill: { width: '100%', borderRadius: 8, minHeight: 4 },
  label: { fontFamily: fonts.body, fontSize: 10 },
});
