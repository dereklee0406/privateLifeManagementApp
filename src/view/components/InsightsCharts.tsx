import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { NetWorthSparkPoint } from '../../model/finance/netWorthSparkline';
import type {
  CompareBars,
  HabitMeter,
  InsightsGlanceTile,
  MonthPace,
  MonthWritingBar,
  MoodClimateSegment,
  WeekStripCell,
} from '../../model/insights/boardFacts';
import { formatFriendlyMoney } from '../../model/finance/Expense';
import type { MoodId } from '../../model/journal/Mood';
import { appHref } from '../../utils/navigation';
import { hapticLight } from '../../utils/haptics';
import { localizeGlanceDelta, localizeGlanceValue, useI18n, type Translate } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface, raisedSurface, type ThemeColors } from '../theme/tokens';
import { InsightsMonthWritingBars, InsightsWeekStrip } from './InsightsWeekStrip';
import { NetWorthSparkline } from './NetWorthSparkline';

const CHART_HREF = {
  writing: '/(tabs)/journal',
  habits: '/(tabs)/calendar?tab=streaks',
  spend: '/(tabs)/money?segment=cashflow',
  mood: '/(tabs)/journal',
  worth: '/(tabs)/money?segment=worth',
} as const;

const MIX_LABEL: Record<MoodId, string> = {
  happy: 'mood.happy',
  neutral: 'mood.neutral',
  sad: 'mood.sad',
  angry: 'mood.angry',
};

/**
 * Purpose: shared raised clay frame for one Insights chart — title, viz, caption, hub tap.
 * Inputs: title, a11y, optional href, caption, empty flag, children.
 * Outputs: presentation only. 44pt hit. Static (no decorative animation).
 * Side effects: haptic + navigation when href is set.
 * Design decisions: empty still draws the frame. Numbers live in the caption, not a 2×2 tile grid.
 */
function ChartFrame({
  title,
  accessibilityLabel,
  href,
  caption,
  children,
}: {
  title: string;
  accessibilityLabel: string;
  href: string;
  caption: string;
  children: ReactNode;
}) {
  const colors = useThemeColors();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => {
        void hapticLight();
        router.push(appHref(href));
      }}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${accessibilityLabel}. ${caption}`}
      style={({ pressed }) => [
        raisedSurface(colors, 22),
        styles.frame,
        { opacity: pressed ? 0.86 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      <Text style={[styles.title, { color: colors.accent }]}>{title}</Text>
      <View style={styles.viz} accessibilityElementsHidden>
        {children}
      </View>
      <Text style={[styles.caption, { color: colors.ink }]} numberOfLines={2}>
        {caption}
      </Text>
    </Pressable>
  );
}

/**
 * Purpose: localize the spend compare caption (this vs last, or first-stretch invite).
 * Inputs: translator, spend tile, compare bars.
 * Outputs: field-notebook line.
 * Side effects: none.
 */
function spendCaption(t: Translate, tile: InsightsGlanceTile | undefined, compare: CompareBars): string {
  if (!tile || (compare.current === 0 && !compare.hasPrevious)) {
    return t('insights.inviteSpend');
  }
  const now = localizeGlanceValue(t, tile);
  const delta = localizeGlanceDelta(t, tile);
  return `${now} · ${delta}`;
}

/**
 * Purpose: localize habit caption — percent or invite when the domain is missing.
 * Inputs: translator, meter.
 * Outputs: catalog string.
 * Side effects: none.
 */
function habitCaption(t: Translate, meter: HabitMeter): string {
  if (meter.rate === null) {
    return t('insights.inviteHabit');
  }
  return t('insights.habitLine', { percent: Math.round(meter.rate * 100) });
}

/**
 * Purpose: mood stacked-bar caption — mix, or invite when the window is empty.
 * Inputs: translator, segments.
 * Outputs: catalog string.
 * Side effects: none.
 */
function moodCaption(t: Translate, segments: MoodClimateSegment[]): string {
  const total = segments.reduce((sum, row) => sum + row.count, 0);
  if (total === 0) {
    return t('insights.chartMoodEmpty');
  }
  const top = [...segments].sort((left, right) => right.count - left.count)[0];
  if (!top || top.count === 0) {
    return t('insights.chartMoodEmpty');
  }
  return t('insights.chartMoodLead', { mood: t(MIX_LABEL[top.climate]) });
}

/**
 * Purpose: This week chart pack — writing strip, habit meter, spend compare, mood mix.
 * Inputs: weekly board series + pages caption + spend tile for money labels.
 * Outputs: stacked clay charts (presentation).
 * Side effects: child frames navigate to Journal / Focus / Wallet.
 * Design decisions: View bars only. No MoodTrendCharts dump. Glance tiles stay in Model for captions.
 */
export function InsightsWeekCharts({
  strip,
  spendCompare,
  habitMeter,
  moodClimate,
  spendTile,
  pagesCaption,
}: {
  strip: WeekStripCell[];
  spendCompare: CompareBars;
  habitMeter: HabitMeter;
  moodClimate: MoodClimateSegment[];
  spendTile: InsightsGlanceTile | undefined;
  pagesCaption: string;
}) {
  const { t } = useI18n();
  const wrote = strip.filter((cell) => cell.wrote).length;
  const habits = strip.filter((cell) => cell.habitHit).length;

  return (
    <View style={styles.stack}>
      <ChartFrame
        title={t('insights.chartWriting')}
        href={CHART_HREF.writing}
        accessibilityLabel={t('insights.stripA11y', { wrote, habits })}
        caption={pagesCaption}
      >
        <InsightsWeekStrip cells={strip} embedded />
      </ChartFrame>
      <HabitChart meter={habitMeter} />
      <SpendCompareChart compare={spendCompare} tile={spendTile} />
      <MoodChart segments={moodClimate} />
    </View>
  );
}

/**
 * Purpose: This month chart pack — 30 writing bars, habit, spend compare, Worth spark, mood mix.
 * Inputs: monthly board series + captions/tiles.
 * Outputs: stacked clay charts (presentation).
 * Side effects: child frames navigate to Journal / Focus / Wallet / Worth.
 * Design decisions: Worth reuses NetWorthSparkline. Mood is last-30 mix, not weekly/monthly dumps.
 */
export function InsightsMonthCharts({
  writingBars,
  pace,
  spendCompare,
  habitMeter,
  moodClimate,
  worthSpark,
  spendTile,
  worthTile,
  pagesCaption,
}: {
  writingBars: MonthWritingBar[];
  pace: MonthPace;
  spendCompare: CompareBars;
  habitMeter: HabitMeter;
  moodClimate: MoodClimateSegment[];
  worthSpark: NetWorthSparkPoint[];
  spendTile: InsightsGlanceTile | undefined;
  worthTile: InsightsGlanceTile | undefined;
  pagesCaption: string;
}) {
  const { t } = useI18n();
  const writingCaption =
    pace.writingDays === 0 ? t('insights.inviteWrite') : `${pagesCaption} · ${t('insights.paceLabel', { done: pace.writingDays, elapsed: pace.elapsedDays })}`;
  const worthEmpty = worthSpark.length === 0;
  const worthCaption = worthEmpty
    ? t('insights.inviteWorth')
    : worthTile
      ? `${localizeGlanceValue(t, worthTile)} · ${t('insights.worthVsSnapshot')}`
      : t('insights.netWorthNone');

  return (
    <View style={styles.stack}>
      <ChartFrame
        title={t('insights.chartWriting')}
        href={CHART_HREF.writing}
        accessibilityLabel={t('insights.paceA11y', { done: pace.writingDays, elapsed: pace.elapsedDays })}
        caption={writingCaption}
      >
        <InsightsMonthWritingBars bars={writingBars} />
      </ChartFrame>
      <HabitChart meter={habitMeter} />
      <SpendCompareChart compare={spendCompare} tile={spendTile} />
      <ChartFrame
        title={t('insights.chartWorth')}
        href={CHART_HREF.worth}
        accessibilityLabel={
          worthEmpty
            ? t('insights.chartWorthEmptyA11y')
            : t('insights.chartWorthA11y', { count: worthSpark.length })
        }
        caption={worthCaption}
      >
        {worthEmpty ? <EmptyTrack /> : <NetWorthSparkline points={worthSpark} accessibilityLabel="" />}
      </ChartFrame>
      <MoodChart segments={moodClimate} />
    </View>
  );
}

/**
 * Purpose: habit-hit inset meter with tabular % — empty frame when no habits.
 * Inputs: HabitMeter from Model.
 * Outputs: chart frame (presentation).
 * Side effects: navigates to Focus streaks.
 */
function HabitChart({ meter }: { meter: HabitMeter }) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const percent = meter.rate === null ? null : Math.round(meter.rate * 100);
  const a11y =
    percent === null ? t('insights.chartHabitsEmptyA11y') : t('insights.chartHabitsA11y', { percent });

  return (
    <ChartFrame
      title={t('insights.chartHabits')}
      href={CHART_HREF.habits}
      accessibilityLabel={a11y}
      caption={habitCaption(t, meter)}
    >
      <View style={styles.habitRow}>
        <View style={[insetSurface(colors, 44), styles.habitWell]}>
          <Text style={[styles.habitScore, { color: colors.ink }]}>
            {percent === null ? t('insights.emptyMark') : `${percent}%`}
          </Text>
        </View>
        <View style={[insetSurface(colors, 8), styles.habitTrack]}>
          <View
            style={[
              styles.habitFill,
              {
                width: percent && percent > 0 ? `${Math.max(6, percent)}%` : 0,
                minWidth: percent && percent > 0 ? 6 : 0,
                backgroundColor: colors.accent,
              },
            ]}
          />
        </View>
      </View>
    </ChartFrame>
  );
}

/**
 * Purpose: two-bar spend compare (this vs last) with clay wells.
 * Inputs: CompareBars + spend glance tile for money labels.
 * Outputs: chart frame (presentation).
 * Side effects: navigates to Wallet cashflow.
 */
function SpendCompareChart({
  compare,
  tile,
}: {
  compare: CompareBars;
  tile: InsightsGlanceTile | undefined;
}) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const currency = tile?.currency;
  const currentLabel = currency ? formatFriendlyMoney(compare.current, currency) : String(Math.round(compare.current));
  const previousLabel = compare.hasPrevious
    ? currency
      ? formatFriendlyMoney(compare.previous, currency)
      : String(Math.round(compare.previous))
    : t('insights.emptyMark');
  const a11y = t('insights.chartSpendA11y', { current: currentLabel, previous: previousLabel });

  return (
    <ChartFrame
      title={t('insights.chartSpend')}
      href={CHART_HREF.spend}
      accessibilityLabel={a11y}
      caption={spendCaption(t, tile, compare)}
    >
      <View style={styles.compareRow}>
        <CompareColumn
          label={t('insights.chartThis')}
          ratio={compare.currentRatio}
          amount={currentLabel}
          colors={colors}
        />
        <CompareColumn
          label={t('insights.chartLast')}
          ratio={compare.previousRatio}
          amount={previousLabel}
          colors={colors}
        />
      </View>
    </ChartFrame>
  );
}

/**
 * Purpose: one compare column — inset track, static fill, tabular amount.
 * Inputs: label, 0–1 ratio, amount string, theme.
 * Outputs: presentation.
 * Side effects: none.
 */
function CompareColumn({
  label,
  ratio,
  amount,
  colors,
}: {
  label: string;
  ratio: number;
  amount: string;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.compareCol}>
      <Text style={[styles.compareAmount, { color: colors.ink }]}>{amount}</Text>
      <View style={[insetSurface(colors, 8), styles.compareTrack]}>
        <View
          style={[
            styles.compareFill,
            {
              height: `${Math.round(ratio * 100)}%`,
              backgroundColor: colors.accent,
              minHeight: ratio > 0 ? 6 : 0,
            },
          ]}
        />
      </View>
      <Text style={[styles.compareLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

/**
 * Purpose: small Good / Steady / Off / Rough stacked bar from Model segments.
 * Inputs: four mood slices.
 * Outputs: chart frame (presentation). Not a MoodTrendCharts dump.
 * Side effects: navigates to Journal.
 */
function MoodChart({ segments }: { segments: MoodClimateSegment[] }) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const total = segments.reduce((sum, row) => sum + row.count, 0);
  const good = segments.find((row) => row.climate === 'happy')?.count ?? 0;
  const steady = segments.find((row) => row.climate === 'neutral')?.count ?? 0;
  const off = segments.find((row) => row.climate === 'sad')?.count ?? 0;
  const rough = segments.find((row) => row.climate === 'angry')?.count ?? 0;
  const a11y =
    total === 0
      ? t('insights.chartMoodEmptyA11y')
      : t('insights.chartMoodA11y', { good, steady, off, rough });

  return (
    <ChartFrame
      title={t('insights.chartMood')}
      href={CHART_HREF.mood}
      accessibilityLabel={a11y}
      caption={moodCaption(t, segments)}
    >
      <View style={[insetSurface(colors, 8), styles.moodTrack]}>
        {total === 0 ? (
          <View style={styles.moodEmpty} />
        ) : (
          segments.map((row) =>
            row.count === 0 ? null : (
              <View
                key={row.climate}
                style={{
                  flexGrow: row.share,
                  flexBasis: 0,
                  minWidth: 8,
                  height: '100%',
                  backgroundColor: colors.mood[row.climate],
                }}
              />
            ),
          )
        )}
      </View>
      <View style={styles.moodLegend}>
        {segments.map((row) => (
          <Text key={row.climate} style={[styles.moodLegendItem, { color: colors.mood[row.climate] }]}>
            {t(MIX_LABEL[row.climate])}
          </Text>
        ))}
      </View>
    </ChartFrame>
  );
}

/**
 * Purpose: empty inset well so a missing Worth series still looks designed.
 * Inputs: none (theme via hook).
 * Outputs: 56pt well.
 * Side effects: none.
 */
function EmptyTrack() {
  const colors = useThemeColors();
  return <View style={[insetSurface(colors, 8), styles.emptyTrack]} />;
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  frame: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 10,
    minHeight: 44,
  },
  title: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  viz: {
    gap: 8,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  habitWell: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitScore: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  habitTrack: {
    flex: 1,
    height: 14,
    overflow: 'hidden',
    minWidth: 44,
  },
  habitFill: {
    height: '100%',
    borderRadius: 8,
    minWidth: 6,
  },
  compareRow: {
    flexDirection: 'row',
    gap: 16,
    height: 108,
  },
  compareCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  compareAmount: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  compareTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  compareFill: {
    width: '100%',
    borderRadius: 8,
  },
  compareLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  moodTrack: {
    flexDirection: 'row',
    height: 16,
    overflow: 'hidden',
  },
  moodEmpty: {
    flex: 1,
  },
  moodLegend: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  moodLegendItem: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
  },
  emptyTrack: {
    height: 56,
  },
});
