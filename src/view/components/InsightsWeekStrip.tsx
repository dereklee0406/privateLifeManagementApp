import { StyleSheet, Text, View } from 'react-native';
import type { MonthPace, WeekStripCell } from '../../model/insights/boardFacts';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface } from '../theme/tokens';

/**
 * Purpose: 7-cell week texture — writing fill, habit pip, today ring; future stays empty.
 * Inputs: strip cells from Model.
 * Outputs: inset clay row (presentation). Not tappable per day (that would be a calendar dump).
 * Side effects: none.
 * Design decisions: View bars like Worth sparkline. Habit pips are a glance, not a streak list.
 */
export function InsightsWeekStrip({ cells }: { cells: WeekStripCell[] }) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const wrote = cells.filter((cell) => cell.wrote).length;
  const habits = cells.filter((cell) => cell.habitHit).length;
  const showPips = cells.some((cell) => cell.habitHit);

  return (
    <View
      style={[insetSurface(colors, 18), styles.well]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('insights.stripA11y', { wrote, habits })}
    >
      {cells.map((cell) => {
        const fill = cell.isFuture ? 'transparent' : cell.wrote ? colors.accent : colors.line;
        return (
          <View key={cell.dayKey} style={styles.slot}>
            <View
              style={[
                styles.cell,
                {
                  backgroundColor: fill,
                  borderWidth: cell.isToday ? 1.5 : 0,
                  borderColor: colors.accent,
                },
              ]}
            />
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
 * Purpose: month writing pace bar — writing days vs elapsed days this month.
 * Inputs: MonthPace from Model.
 * Outputs: inset track + tabular caption.
 * Side effects: none.
 * Design decisions: one bar, not a calendar. Over-pace still fills to 100%.
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
    minHeight: 52,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  cell: {
    width: '100%',
    height: 28,
    borderRadius: 8,
    minHeight: 28,
  },
  pip: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
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
