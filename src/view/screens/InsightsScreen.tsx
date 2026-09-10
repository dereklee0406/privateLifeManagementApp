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
import { computeMonthlyInsightsReport } from '../../model/insights/monthlyReport';
import { buildMonthlyShareFacts } from '../../model/insights/monthlyShare';
import type { InsightsPressure } from '../../model/insights/pressure';
import { pickTodayPrediction } from '../../model/insights/predictions';
import { computeWeeklyInsightsReport } from '../../model/insights/weeklyReport';
import { computeSeasonRank } from '../../model/season/seasonRank';
import { resolveWeekStart } from '../../model/settings/AppSettings';
import { nextUpCard } from '../../model/today/nextUp';
import { appHref } from '../../utils/navigation';
import { hapticLight } from '../../utils/haptics';
import { HubCaptureFab } from '../components/HubCaptureFab';
import { HubSegmentControl, type HubSegmentOption } from '../components/HubSegmentControl';
import { InsightsGlanceGrid } from '../components/InsightsGlanceGrid';
import { InsightsSeasonHero } from '../components/InsightsSeasonHero';
import { InsightsTakeaway } from '../components/InsightsTakeaway';
import { InsightsMonthPace, InsightsWeekStrip } from '../components/InsightsWeekStrip';
import { LargeTitle } from '../components/LargeTitle';
import { MonthlyReportShareButton } from '../components/MonthlyReportShareButton';
import { ScreenScaffold } from '../components/ScreenScaffold';
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
 * Purpose: deep-link path for a pressure kind (synthesis, not a reprinted list).
 * Inputs: pressure id.
 * Outputs: in-app href.
 * Side effects: none.
 */
function hrefForPressure(pressure: InsightsPressure): string {
  if (pressure === 'overdue') {
    return '/(tabs)/calendar?tab=tasks';
  }
  if (pressure === 'habits') {
    return '/(tabs)/calendar?tab=streaks';
  }
  if (pressure === 'budget' || pressure === 'spendUp') {
    return '/(tabs)/money?segment=cashflow';
  }
  if (pressure === 'worth') {
    return '/(tabs)/money?segment=worth';
  }
  if (pressure === 'writing' || pressure === 'quiet') {
    return '/(tabs)/journal';
  }
  return '/(tabs)';
}

/**
 * Purpose: Tab 5 Insights — This week | This month board pack + deep links.
 * Inputs: journal / reminders / finance / settings; optional `segment` query.
 * Outputs: header, settings cog, two segments, Season hero, glance tiles, takeaway, share (month).
 * Side effects: navigates to Settings or hub deep links; segment haptic via HubSegmentControl.
 * Design decisions: math stays in Model. One visual hero, then tiles, then texture, then the
 *   take. No reprint of Rhythm streak lists or Wallet category rows. Close-the-day is skipped
 *   so Today stays a 30s loop. HubCaptureFab stays.
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

        {segment === 'week' ? <WeekPanel /> : <MonthPanel />}
      </ScrollView>
      <HubCaptureFab />
    </ScreenScaffold>
  );
}

/**
 * Purpose: This week board pack — Season hero, glance tiles, week strip, takeaway, prediction echo.
 * Inputs: providers; weekly report + board facts + Season in Model.
 * Outputs: presentation only.
 * Side effects: deep-link navigation from child tiles.
 */
function WeekPanel() {
  const colors = useThemeColors();
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
      <Text style={[type.subhead, styles.lede, { color: colors.muted }]}>{t('insights.weekLede')}</Text>
      <InsightsSeasonHero season={season} />
      {prediction ? <TodayPredictionLine prediction={prediction} /> : null}
      <InsightsGlanceGrid tiles={board.tiles} />
      <InsightsWeekStrip cells={board.strip} />
      {board.sparse ? (
        <SparseInvites
          note={t('insights.emptyWeek')}
          showWorth={false}
        />
      ) : null}
      <InsightsTakeaway line={copy.pressureLine} href={hrefForPressure(report.pressure)} />
    </View>
  );
}

/**
 * Purpose: This month board pack — Season hero, glance tiles, pace, takeaway, share card.
 * Inputs: providers; monthly report + board facts + Season in Model.
 * Outputs: presentation only.
 * Side effects: deep-link navigation from child tiles; share via MonthlyReportShareButton.
 */
function MonthPanel() {
  const colors = useThemeColors();
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
    () => computeMonthlyBoardFacts(report, entries, reminders, now),
    [report, entries, reminders, now],
  );
  const copy = useMemo(() => localizeMonthlyInsights(t, report), [t, report]);
  const season = useSeason(now);
  const shareFacts = useMemo(
    () => buildMonthlyShareFacts(report, season.rank, now),
    [report, season.rank, now],
  );

  return (
    <View style={styles.panelStack}>
      <Text style={[type.subhead, styles.lede, { color: colors.muted }]}>{t('insights.monthLede')}</Text>
      <InsightsSeasonHero season={season} hint />
      <InsightsGlanceGrid tiles={board.tiles} />
      <InsightsMonthPace pace={board.pace} />
      {board.sparse ? <SparseInvites note={t('insights.emptyMonth')} showWorth /> : null}
      <InsightsTakeaway line={copy.pressureLine} href={hrefForPressure(report.pressure)} />
      <MonthlyReportShareButton facts={shareFacts} />
    </View>
  );
}

/**
 * Purpose: derive Season for Insights hero (same Model as Today).
 * Inputs: now (caller-frozen).
 * Outputs: SeasonRank.
 * Side effects: none.
 */
function useSeason(now: Date) {
  const { entries } = useJournal();
  const { reminders } = useReminders();
  const { expenses, budgets } = useFinance();
  const { settings } = useSettings();
  return useMemo(
    () => computeSeasonRank(entries, reminders, budgets, expenses, settings.defaultCurrency, now),
    [entries, reminders, budgets, expenses, settings.defaultCurrency, now],
  );
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
