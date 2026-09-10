import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { InsightsDeltaFlavor, InsightsGlanceTile, InsightsTileId } from '../../model/insights/boardFacts';
import { appHref } from '../../utils/navigation';
import { hapticLight } from '../../utils/haptics';
import { localizeGlanceDelta, localizeGlanceLabel, localizeGlanceValue, useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, raisedSurface, type ThemeColors } from '../theme/tokens';

const TILE_HREF: Record<InsightsTileId, string> = {
  pages: '/(tabs)/journal',
  writingDays: '/(tabs)/journal',
  habits: '/(tabs)/calendar?tab=streaks',
  spend: '/(tabs)/money?segment=cashflow',
  worth: '/(tabs)/money?segment=worth',
};

/**
 * Purpose: pick ink for a vs-last line — spend up is heat; pages/habits/worth up is clay.
 * Inputs: flavor, signed delta, theme.
 * Outputs: color token.
 * Side effects: none.
 */
function deltaColor(flavor: InsightsDeltaFlavor, delta: number, colors: ThemeColors): string {
  if (delta === 0) {
    return colors.muted;
  }
  const good = flavor === 'moreIsGood' ? delta > 0 : delta < 0;
  return good ? colors.accent : colors.danger;
}

/**
 * Purpose: 2-column Insights board grid — number, short label, vs-last; tap opens a hub.
 * Inputs: glance tiles from Model.
 * Outputs: presentation only.
 * Side effects: haptic + navigation.
 * Design decisions: missing domains show “—” + invite, not a faked 0. 44pt hit. Tabular nums
 *   on money/%. Not a reprint of Rhythm streaks or Wallet category rows.
 */
export function InsightsGlanceGrid({ tiles }: { tiles: InsightsGlanceTile[] }) {
  const colors = useThemeColors();
  const router = useRouter();
  const { t } = useI18n();

  return (
    <View style={styles.grid}>
      {tiles.map((tile) => {
        const label = localizeGlanceLabel(t, tile.id);
        const value = localizeGlanceValue(t, tile);
        const deltaLine = localizeGlanceDelta(t, tile);
        const tone =
          tile.delta && tile.delta.hasPrevious
            ? deltaColor(tile.flavor, tile.delta.delta, colors)
            : tile.id === 'worth' && tile.value !== null && tile.value !== 0
              ? deltaColor('moreIsGood', tile.value, colors)
              : colors.muted;
        return (
          <View key={tile.id} style={styles.cell}>
            <Pressable
              onPress={() => {
                void hapticLight();
                router.push(appHref(TILE_HREF[tile.id]));
              }}
              accessibilityRole="button"
              accessibilityLabel={`${label}. ${value}. ${deltaLine}`}
              style={({ pressed }) => [
                raisedSurface(colors, 22),
                styles.tile,
                { opacity: pressed ? 0.82 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              <Text style={[styles.label, { color: colors.accent }]}>{label}</Text>
              <Text style={[styles.value, { color: colors.ink }]}>{value}</Text>
              <Text style={[styles.delta, { color: tone }]} numberOfLines={2}>
                {deltaLine}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  cell: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 140,
  },
  tile: {
    minHeight: 108,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 4,
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  value: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  delta: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
});
