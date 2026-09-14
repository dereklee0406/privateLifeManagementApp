import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../../controller/FinanceProvider';
import { useJournal } from '../../controller/JournalProvider';
import { useReminders } from '../../controller/ReminderProvider';
import { useSettings } from '../../controller/SettingsProvider';
import { computeMonthlyBoardFacts, computeWeeklyBoardFacts } from '../../model/insights/boardFacts';
import { hrefForPressure } from '../../model/insights/insightsBrief';
import { computeMonthlyInsightsReport } from '../../model/insights/monthlyReport';
import { buildMonthlyShareFacts } from '../../model/insights/monthlyShare';
import { pickTodayPrediction } from '../../model/insights/predictions';
import { computeWeeklyInsightsReport } from '../../model/insights/weeklyReport';
import { computeSeasonRank, computeSeasonTrend } from '../../model/season/seasonRank';
import { buildSeasonShareFacts } from '../../model/season/seasonShare';
import { resolveWeekStart } from '../../model/settings/AppSettings';
import { nextUpCard } from '../../model/today/nextUp';
import { appHref } from '../../utils/navigation';
import { hapticLight } from '../../utils/haptics';
import { HubCaptureFab } from '../components/HubCaptureFab';
import { HubSegmentControl, type HubSegmentOption } from '../components/HubSegmentControl';
import { InsightsMonthCharts, InsightsWeekCharts } from '../components/InsightsCharts';
import { InsightsSeasonHero } from '../components/InsightsSeasonHero';
import { InsightsTakeaway } from '../components/InsightsTakeaway';
import { LargeTitle } from '../components/LargeTitle';
import { MonthlyReportShareButton } from '../components/MonthlyReportShareButton';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SeasonShareButton } from '../components/SeasonShareButton';
import { TodayPredictionLine } from '../components/TodayPredictionLine';
import { localizeMonthlyInsights, localizeWeeklyInsights, useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, raisedSurface } from '../theme/tokens';
import { tabScenePaddingBottom, type } from '../theme/typography';

export type InsightsSegment = 'week' | 'month';

/**
 * Purpose: parse Insights deep-link `segment` (Today Season hero → This month).
 * Inputs: raw query.
 * Outputs: week | month | null.
 * Side effects: none.
 */
function parseInsightsSegment(raw: string | string[] | undefined): InsightsSegment | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === 'week' || value === 'month') {
    return value;
  }
  return null;
}

/**
 * Purpose: Tab 5 Insights — This week | This month as data viz, one-line takeaway.
 * Inputs: journal / reminders / finance / settings; optional `segment` query.
 * Outputs: header, settings cog, two segments, takeaway, Season meter, View charts.
 * Side effects: navigates to Settings or hub deep links; segment haptic via HubSegmentControl.
 * Design decisions: series math stays in Model. Charts are primary (writing / habit / spend /
 *   mood / Worth spark). Takeaway is the verdict. Share Season uses the month-card capture path.
 *   No MoodTrendCharts dump. No reprint of Focus streak lists or Wallet category rows.
 */
export function InsightsScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ segment?: string | string[] }>();
  const [segment, setSegment] = useState<InsightsSegment>(() => parseInsightsSegment(params.segment) ?? 'week');

  useEffect(() => {
    const next = parseInsightsSegment(params.segment);
    if (next) {
      setSegment(next);
    }
  }, [params.segment]);

  const segmentOptions = useMemo<HubSegmentOption<InsightsSegment>[]>(
    () => [
      { id: 'week', label: t('insights.tabWeek'), icon: 'calendar-outline' },
      { id: 'month', label: t('insights.tabMonth'), icon: 'stats-chart-outline' },
    ],
    [t],
  );

  return (
    <ScreenScaffold>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: tabScenePaddingBottom(insets.bottom) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <View style={styles.titleBlock}>
            {t('insights.headerKicker') ? (
              <Text style={[type.footnote, styles.headerKicker, { color: colors.accent }]}>
                {t('insights.headerKicker')}
              </Text>
            ) : null}
            <LargeTitle title={t('insights.headerTitle')} />
          </View>
          <Pressable
            onPress={() => {
              void hapticLight();
              router.push(appHref('/settings'));
            }}
            style={({ pressed }) => [
              raisedSurface(colors, 22),
              styles.settingsButton,
              {
                transform: [{ scale: pressed ? 0.94 : 1 }],
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('tabs.settings')}
          >
            <Ionicons
              name="settings-outline"
              size={22}
              color={colors.ink}
              accessible={false}
              importantForAccessibility="no"
            />
          </Pressable>
        </View>

        <HubSegmentControl options={segmentOptions} value={segment} onChange={setSegment} />

        {segment === 'week' ? <WeekChartsPanel /> : <MonthChartsPanel />}
      </ScrollView>
      <HubCaptureFab />
    </ScreenScaffold>
  );
}

/**
 * Purpose: This week board pack — one-line takeaway, then Season meter and View charts.
 * Inputs: providers; weekly report + board facts + Season in Model.
 * Outputs: presentation only.
 * Side effects: deep-link navigation from child charts.
 * Design decisions: takeaway is the verdict. Share Season sits under the hero.
 */
export function WeekChartsPanel() {
  const { t } = useI18n();
  const { entries } = useJournal();
  const { reminders, creditCards } = useReminders();
  const { expenses, budgets, recurringSpends } = useFinance();
  const { settings } = useSettings();
  const now = useMemo(
    () => new Date(),
    [entries.length, reminders.length, expenses.length, budgets.length, recurringSpends.length],
  );
  const weekStartsOn = resolveWeekStart(settings);
  const report = useMemo(
    () =>
      computeWeeklyInsightsReport(
        entries,
        expenses,
        reminders,
        budgets,
        settings.defaultCurrency,
        now,
        creditCards,
        weekStartsOn,
      ),
    [entries, expenses, reminders, budgets, settings.defaultCurrency, now, creditCards, weekStartsOn],
  );
  const board = useMemo(
    () => computeWeeklyBoardFacts(report, entries, expenses, reminders, now, weekStartsOn),
    [report, entries, expenses, reminders, now, weekStartsOn],
  );
  const copy = useMemo(() => localizeWeeklyInsights(t, report), [t, report]);
  const season = useSeason(now);
  const next = useMemo(
    () => nextUpCard(reminders, creditCards, settings.defaultCurrency, now),
    [reminders, creditCards, settings.defaultCurrency, now],
  );
  const prediction = useMemo(
    () =>
      pickTodayPrediction({
        reminders,
        creditCards,
        recurringSpends,
        expenses,
        budgets,
        journalDaysWrittenThisWeek: report.daysWritten,
        currency: settings.defaultCurrency,
        now,
        nextUp: next,
      }),
    [reminders, creditCards, recurringSpends, expenses, budgets, report.daysWritten, settings.defaultCurrency, now, next],
  );

  return (
    <View style={styles.panelStack}>
      <InsightsTakeaway line={copy.pressureLine} href={hrefForPressure(report.pressure)} />
      {prediction ? <TodayPredictionLine prediction={prediction} /> : null}
      <InsightsSeasonHero season={season.rankSnapshot} />
      <SeasonShareButton facts={season.shareFacts} />
      <InsightsWeekCharts
        strip={board.strip}
        spendCompare={board.spendCompare}
        habitMeter={board.habitMeter}
        moodClimate={board.moodClimate}
        spendTile={board.tiles.find((tile) => tile.id === 'spend')}
        pagesCaption={copy.pagesLine}
      />
      {board.sparse ? (
        <SparseInvites
          note={t('insights.emptyWeek')}
          showWorth={false}
        />
      ) : null}
    </View>
  );
}

/**
 * Purpose: This month board pack — one-line takeaway, then Season / charts / share.
 * Inputs: providers; monthly report + board facts + Season in Model.
 * Outputs: presentation only.
 * Side effects: deep-link navigation from child charts; share via MonthlyReportShareButton.
 * Design decisions: takeaway is the verdict. Brief builders stay off this View.
 */
export function MonthChartsPanel() {
  const { t } = useI18n();
  const { entries } = useJournal();
  const { reminders } = useReminders();
  const { expenses, budgets, netWorthHistory } = useFinance();
  const { settings } = useSettings();
  const now = useMemo(
    () => new Date(),
    [entries.length, reminders.length, expenses.length, budgets.length, netWorthHistory.length],
  );
  const report = useMemo(
    () =>
      computeMonthlyInsightsReport(
        entries,
        expenses,
        reminders,
        budgets,
        netWorthHistory,
        settings.defaultCurrency,
        now,
      ),
    [entries, expenses, reminders, budgets, netWorthHistory, settings.defaultCurrency, now],
  );
  const board = useMemo(
    () => computeMonthlyBoardFacts(report, entries, reminders, now, netWorthHistory),
    [report, entries, reminders, now, netWorthHistory],
  );
  const copy = useMemo(() => localizeMonthlyInsights(t, report), [t, report]);
  const season = useSeason(now);
  const shareFacts = useMemo(
    () => buildMonthlyShareFacts(report, season.rankSnapshot.rank, now),
    [report, season.rankSnapshot.rank, now],
  );

  return (
    <View style={styles.panelStack}>
      <InsightsTakeaway line={copy.pressureLine} href={hrefForPressure(report.pressure)} />
      <InsightsSeasonHero season={season.rankSnapshot} hint />
      <SeasonShareButton facts={season.shareFacts} />
      <InsightsMonthCharts
        writingBars={board.writingBars}
        pace={board.pace}
        spendCompare={board.spendCompare}
        habitMeter={board.habitMeter}
        moodClimate={board.moodClimate}
        worthSpark={board.worthSpark}
        spendTile={board.tiles.find((tile) => tile.id === 'spend')}
        worthTile={board.tiles.find((tile) => tile.id === 'worth')}
        pagesCaption={copy.pagesLine}
      />
      {board.sparse ? <SparseInvites note={t('insights.emptyMonth')} showWorth /> : null}
      <MonthlyReportShareButton facts={shareFacts} />
    </View>
  );
}

/**
 * Purpose: derive Season + share facts for Insights hero (same Model as Today).
 * Inputs: now (caller-frozen).
 * Outputs: SeasonRank, week trend, SeasonShareFacts.
 * Side effects: none.
 */
function useSeason(now: Date) {
  const { entries } = useJournal();
  const { reminders } = useReminders();
  const { expenses, budgets } = useFinance();
  const { settings } = useSettings();
  const rankSnapshot = useMemo(
    () => computeSeasonRank(entries, reminders, budgets, expenses, settings.defaultCurrency, now),
    [entries, reminders, budgets, expenses, settings.defaultCurrency, now],
  );
  const trend = useMemo(
    () => computeSeasonTrend(entries, reminders, budgets, expenses, settings.defaultCurrency, now),
    [entries, reminders, budgets, expenses, settings.defaultCurrency, now],
  );
  const shareFacts = useMemo(() => buildSeasonShareFacts(rankSnapshot, trend), [rankSnapshot, trend]);
  return { rankSnapshot, shareFacts };
}

/**
 * Purpose: designed first-week / first-month invites — Write / Habit / Spend (Worth on month).
 * Inputs: empty-board note; whether to include Worth.
 * Outputs: short note + 44pt pills into existing hubs.
 * Side effects: navigation.
 * Design decisions: not a blank scoreboard. Routes match glance tiles. No sixth tab.
 */
function SparseInvites({ note, showWorth }: { note: string; showWorth: boolean }) {
  const colors = useThemeColors();
  const router = useRouter();
  const { t } = useI18n();
  const pills = [
    { label: t('insights.inviteWrite'), href: '/(tabs)/journal' },
    { label: t('insights.inviteHabit'), href: '/(tabs)/calendar?tab=streaks' },
    { label: t('insights.inviteSpend'), href: '/(tabs)/money?segment=cashflow' },
    ...(showWorth ? [{ label: t('insights.inviteWorth'), href: '/(tabs)/money?segment=worth' }] : []),
  ];

  return (
    <View style={styles.sparse}>
      <Text style={[styles.sparseNote, { color: colors.ink }]}>{note}</Text>
      <View style={styles.pills}>
        {pills.map((pill) => (
          <Pressable
            key={pill.href + pill.label}
            onPress={() => {
              void hapticLight();
              router.push(appHref(pill.href));
            }}
            accessibilityRole="button"
            accessibilityLabel={pill.label}
            style={({ pressed }) => [
              raisedSurface(colors, 18),
              styles.pill,
              { opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            <Text style={[styles.pillLabel, { color: colors.ink }]}>{pill.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  headerKicker: {
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelStack: {
    gap: 16,
  },
  lede: {
    marginBottom: -4,
  },
  sparse: {
    gap: 12,
  },
  sparseNote: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 22,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pill: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  pillLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
  },
});
