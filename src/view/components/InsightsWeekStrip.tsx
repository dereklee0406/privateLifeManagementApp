import { StyleSheet, Text, View } from 'react-native';
import type { MonthPace, MonthWritingBar, WeekStripCell } from '../../model/insights/boardFacts';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface } from '../theme/tokens';

/**
 * Purpose: 7-cell week writing chart — tall View bars, habit pip, today ring; future stays empty.
 * Inputs: strip cells from Model; optional `embedded` when the parent chart frame owns a11y.
 * Outputs: inset clay row (presentation). Not tappable per day (that would be a calendar dump).
 * Side effects: none.
 * Design decisions: View bars like Worth sparkline. Wrote = full accent; elapsed empty = stub;
 *   future = faint well. Habit pips are a glance, not a streak list. Static for Reduce Motion.
 */
export function InsightsWeekStrip({
  cells,
  embedded = false,
}: {
  cells: WeekStripCell[];
  embedded?: boolean;
}) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const wrote = cells.filter((cell) => cell.wrote).length;
  const habits = cells.filter((cell) => cell.habitHit).length;
  const showPips = cells.some((cell) => cell.habitHit);

  return (
    <View
      style={[insetSurface(colors, 18), styles.well]}
      accessible={!embedded}
      accessibilityRole="image"
      accessibilityLabel={embedded ? undefined : t('insights.stripA11y', { wrote, habits })}
      accessibilityElementsHidden={embedded}
    >
      {cells.map((cell) => {
        const height = cell.isFuture ? 8 : cell.wrote ? 56 : 14;
        const fill = cell.isFuture ? colors.well : cell.wrote ? colors.accent : colors.line;
        return (
          <View key={cell.dayKey} style={styles.slot}>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.bar,
                  {
                    height,
                    backgroundColor: fill,
                    borderWidth: cell.isToday ? 1.5 : 0,
                    borderColor: colors.accent,
                  },
                ]}
              />
            </View>
            {showPips ? (
              <View
                style={[
                  styles.pip,
                  { backgroundColor: cell.habitHit && !cell.isFuture ? colors.ink : 'transparent' },
                ]}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/**
 * Purpose: month writing 30-bar chart — one View per civil day; future stays empty.
 * Inputs: MonthWritingBar[] from Model.
 * Outputs: inset row of static bars (presentation).
 * Side effects: none.
 * Design decisions: not a calendar and not a Rhythm heatmap. Several pages on one day still
 *   one bar. Reduce Motion: heights are static.
 */
export function InsightsMonthWritingBars({ bars }: { bars: MonthWritingBar[] }) {
  const colors = useThemeColors();

  return (
    <View style={[insetSurface(colors, 14), styles.monthWell]} accessibilityElementsHidden>
      {bars.map((bar) => {
        const height = bar.isFuture ? 6 : bar.wrote ? 48 : 10;
        const fill = bar.isFuture ? colors.well : bar.wrote ? colors.accent : colors.line;
        return (
          <View key={bar.dayKey} style={styles.monthSlot}>
            <View
              style={[
                styles.monthBar,
                {
                  height,
                  backgroundColor: fill,
                  borderWidth: bar.isToday ? 1.5 : 0,
                  borderColor: colors.accent,
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

/**
 * Purpose: month writing pace bar — writing days vs elapsed days this month.
 * Inputs: MonthPace from Model.
 * Outputs: inset track + tabular caption.
 * Side effects: none.
 * Design decisions: kept for reuse; Insights month now prefers the 30-bar chart with this
 *   caption. Over-pace still fills to 100%.
 */
export function InsightsMonthPace({ pace }: { pace: MonthPace }) {
  const colors = useThemeColors();
  const { t } = useI18n();

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('insights.paceA11y', { done: pace.writingDays, elapsed: pace.elapsedDays })}
      style={styles.paceBlock}
    >
      <View style={[insetSurface(colors, 8), styles.paceTrack]}>
        <View
          style={[
            styles.paceFill,
            { width: `${Math.max(6, Math.round(pace.ratio * 100))}%`, backgroundColor: colors.accent },
          ]}
        />
      </View>
      <Text style={[styles.paceLabel, { color: colors.muted }]}>
        {t('insights.paceLabel', { done: pace.writingDays, elapsed: pace.elapsedDays })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  well: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 80,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  barTrack: {
    height: 56,
    width: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 8,
    minHeight: 6,
  },
  pip: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  monthWell: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 12,
    minHeight: 72,
  },
  monthSlot: {
    flex: 1,
    height: 48,
    justifyContent: 'flex-end',
  },
  monthBar: {
    width: '100%',
    borderRadius: 3,
    minHeight: 4,
  },
  paceBlock: {
    gap: 8,
  },
  paceTrack: {
    height: 10,
    overflow: 'hidden',
  },
  paceFill: {
    height: '100%',
    borderRadius: 8,
    minWidth: 8,
  },
  paceLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
});
