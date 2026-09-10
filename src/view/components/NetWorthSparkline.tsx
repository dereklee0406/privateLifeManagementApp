import { StyleSheet, View } from 'react-native';
import type { NetWorthSparkPoint } from '../../model/finance/netWorthSparkline';
import { sparkBarRatios } from '../../model/finance/netWorthSparkline';
import { useThemeColors } from '../theme/ThemeProvider';

/**
 * Purpose: Wallet Worth sparkline from monthly snapshots — View bars, no SVG.
 * Inputs: oldest-first spark points (omit the chart when empty).
 * Outputs: a row of height-scaled bars.
 * Side effects: none.
 * Design decisions: static heights (reduce-motion has nothing to skip). Clay accent fill.
 */
export function NetWorthSparkline({
  points,
  accessibilityLabel,
}: {
  points: NetWorthSparkPoint[];
  accessibilityLabel: string;
}) {
  const colors = useThemeColors();
  const ratios = sparkBarRatios(points);
  if (points.length === 0) {
    return null;
  }
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {ratios.map((ratio, index) => (
        <View key={points[index]?.monthKey ?? String(index)} style={styles.slot}>
          <View
            style={[
              styles.bar,
              {
                height: `${Math.round(ratio * 100)}%`,
                backgroundColor: colors.accent,
              },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    marginTop: 10,
  },
  slot: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    minHeight: 4,
    borderRadius: 4,
  },
});
