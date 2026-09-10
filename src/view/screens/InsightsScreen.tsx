import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../../controller/FinanceProvider';
import { useJournal } from '../../controller/JournalProvider';
import { useReminders } from '../../controller/ReminderProvider';
import { useSettings } from '../../controller/SettingsProvider';
import {
  formatMoney,
  resolveExpenseCategories,
  type ExpenseCategory,
} from '../../model/finance/Expense';
import { budgetProgressFor, monthSpendTotal } from '../../model/finance/financeStats';
import { computeMonthSpendInsight } from '../../model/finance/monthInsights';
import { computeNetWorth } from '../../model/finance/netWorth';
import { resolveShowAdvancedFinance } from '../../model/settings/AppSettings';
import { computeLifeAreas } from '../../model/journal/lifeAreas';
import { getMoodDefinition, normalizeMoodId, type MoodId } from '../../model/journal/Mood';
import {
  calculateHabitStreak,
  computeOverallHabitRhythm,
} from '../../model/reminders/habitStreaks';
import { toDayKey } from '../../utils/dateUtils';
import { appHref } from '../../utils/navigation';
import { hapticLight } from '../../utils/haptics';
import { GlassSurface } from '../components/GlassSurface';
import { HubSegmentControl, type HubSegmentOption } from '../components/HubSegmentControl';
import { LargeTitle } from '../components/LargeTitle';
import { MoodTrendCharts } from '../components/MoodTrendCharts';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { TypeIcon } from '../components/TypeIcon';
import { expenseCategoryLabel, iconForExpenseCategory } from '../icons/typeIcons';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, raisedSurface } from '../theme/tokens';
import { tabScenePaddingBottom, type } from '../theme/typography';

export type InsightsSegment = 'reflection' | 'habits' | 'finance';

/** Soft climate labels for the four MoodId buckets (Home check-in vocabulary). */
const MOOD_CLIMATE_LABEL: Record<MoodId, 'home.moodRadiant' | 'home.moodCalm' | 'home.moodFoggy' | 'home.moodLow'> = {
  happy: 'home.moodRadiant',
  neutral: 'home.moodCalm',
  sad: 'home.moodFoggy',
  angry: 'home.moodLow',
};

/**
 * Purpose: Tab 5 Insights hub — reflection, habit consistency, and money pulse analytics.
 * Inputs: journal / reminders / finance providers; optional none (always lands on Reflection).
 * Outputs: editorial header + settings CTA + HubSegmentControl + active segment panels.
 * Side effects: navigation to `/settings`; segment haptic via HubSegmentControl.
 * Design decisions: thin View orchestration; domain math stays in model helpers. Settings is a
 *   stack push so swipe-back works; Settings is no longer a primary tab.
 */
export function InsightsScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const [segment, setSegment] = useState<InsightsSegment>('reflection');

  const segmentOptions = useMemo<HubSegmentOption<InsightsSegment>[]>(
    () => [
      { id: 'reflection', label: t('insights.tabReflection'), icon: 'leaf-outline' },
      { id: 'habits', label: t('insights.tabHabits'), icon: 'flame-outline' },
      { id: 'finance', label: t('insights.tabFinance'), icon: 'wallet-outline' },
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
            <Text style={[type.footnote, styles.headerKicker, { color: colors.accent }]}>
              {t('insights.headerKicker')}
            </Text>
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

        {segment === 'reflection' ? <ReflectionPanel /> : null}
        {segment === 'habits' ? <HabitsPanel /> : null}
        {segment === 'finance' ? <FinancePanel /> : null}
      </ScrollView>
    </ScreenScaffold>
  );
}

/**
 * Purpose: Reflection & Mood segment — writing rhythm, 30-day climate, life areas.
 * Inputs: JournalProvider insights / moodAnalysis / entries.
 * Outputs: presentation only.
 * Side effects: none.
 */
function ReflectionPanel() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const { insights, moodAnalysis, entries } = useJournal();
  const maxMood = Math.max(1, ...insights.moodShares.map((share) => share.count));
  const lifeAreas = useMemo(() => computeLifeAreas(entries), [entries]);

  return (
    <View style={styles.panelStack}>
      <Text style={[type.subhead, { color: colors.muted }]}>{t('you.insightsLede')}</Text>

      <View style={styles.row}>
        <GlassSurface style={styles.stat} radius={24}>
          <Text style={[styles.statValue, { color: colors.ink }]}>{insights.wordCount}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>{t('you.wordsKept')}</Text>
        </GlassSurface>
        <GlassSurface style={styles.stat} radius={24}>
          <Text style={[styles.statValue, { color: colors.accent }]}>{insights.writingDaysThisWeek}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>{t('you.daysThisWeek')}</Text>
        </GlassSurface>
      </View>

      <GlassSurface style={styles.panel} radius={28}>
        <Text style={[styles.panelTitle, { color: colors.ink }]}>{t('you.moodClimate')}</Text>
        {insights.moodShares.length === 0 ? (
          <Text style={[styles.empty, { color: colors.muted }]}>{t('you.noPagesClimate')}</Text>
        ) : (
          insights.moodShares.map((share) => {
            const moodId = normalizeMoodId(share.mood);
            const mood = getMoodDefinition(moodId);
            const width = `${Math.max(12, (share.count / maxMood) * 100)}%` as `${number}%`;
            return (
              <View key={share.mood} style={styles.moodRow}>
                <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                <Text style={[styles.moodLabel, { color: colors.muted }]}>
                  {t(MOOD_CLIMATE_LABEL[moodId])}
                </Text>
                <View style={[styles.track, { backgroundColor: colors.well }]}>
                  <View style={[styles.fill, { width, backgroundColor: colors.mood[moodId] }]} />
                </View>
                <Text style={[styles.count, { color: colors.faint }]}>{share.count}</Text>
              </View>
            );
          })
        )}
      </GlassSurface>

      <MoodTrendCharts
        last30Days={moodAnalysis.last30Days}
        daily={moodAnalysis.daily}
        weekly={moodAnalysis.weekly}
        monthly={moodAnalysis.monthly}
      />

      {lifeAreas.length > 0 ? (
        <GlassSurface style={styles.panel} radius={28}>
          <Text style={[styles.panelTitle, { color: colors.ink }]}>{t('you.lifeAreas')}</Text>
          {lifeAreas.map((area) => {
            const width = `${Math.max(8, area.percent)}%` as `${number}%`;
            const areaKey = `types.${area.id}`;
            const areaLabel = t(areaKey);
            return (
              <View key={area.id} style={styles.moodRow}>
                <Text style={[styles.moodLabel, { color: colors.muted, width: 72 }]} numberOfLines={2}>
                  {areaLabel !== areaKey ? areaLabel : area.label}
                </Text>
                <View style={[styles.track, { backgroundColor: colors.well }]}>
                  <View style={[styles.fill, { width, backgroundColor: colors.accent }]} />
                </View>
                <Text style={[styles.count, { color: colors.faint, width: 36 }]}>{area.percent}%</Text>
              </View>
            );
          })}
        </GlassSurface>
      ) : null}
    </View>
  );
}

/**
 * Purpose: Habits & Consistency segment — active habits, streak records, 30/90-day rhythm.
 * Inputs: ReminderProvider recurring habits.
 * Outputs: presentation only; streak math in habitStreaks model.
 * Side effects: none.
 */
function HabitsPanel() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const { reminders } = useReminders();
  const todayKey = toDayKey(new Date());

  const habits = useMemo(
    () => reminders.filter((row) => row.enabled && row.recurrence.type !== 'once'),
    [reminders],
  );

  const overall = useMemo(
    () => computeOverallHabitRhythm(habits, todayKey),
    [habits, todayKey],
  );

  const streakRows = useMemo(
    () =>
      habits
        .map((habit) => ({ habit, streak: calculateHabitStreak(habit, todayKey) }))
        .sort((left, right) => right.streak.bestStreak - left.streak.bestStreak)
        .slice(0, 5),
    [habits, todayKey],
  );

  const bestEver = streakRows.reduce((max, row) => Math.max(max, row.streak.bestStreak), 0);

  if (habits.length === 0) {
    return (
      <GlassSurface style={styles.panel} radius={28}>
        <Text style={[styles.panelTitle, { color: colors.ink }]}>{t('habits.streaksTitle')}</Text>
        <Text style={[styles.empty, { color: colors.muted }]}>{t('habits.emptyStateHint')}</Text>
      </GlassSurface>
    );
  }

  return (
    <View style={styles.panelStack}>
      <View style={styles.row}>
        <GlassSurface style={styles.stat} radius={24}>
          <Text style={[styles.statValue, { color: colors.accent }]}>
            {`${Math.round(overall.overallConsistency30Days * 100)}%`}
          </Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>{t('habits.overallRhythm')}</Text>
        </GlassSurface>
        <GlassSurface style={styles.stat} radius={24}>
          <Text style={[styles.statValue, { color: colors.ink }]}>{overall.activeHabitCount}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>
            {t('habits.activeHabitsCount', { count: overall.activeHabitCount })}
          </Text>
        </GlassSurface>
      </View>

      <GlassSurface style={styles.panel} radius={28}>
        <Text style={[styles.panelTitle, { color: colors.ink }]}>{t('habits.rhythmMatrix')}</Text>
        <View style={styles.metricRow}>
          <Text style={[styles.statLabel, { color: colors.muted }]}>{t('habits.currentStreak')}</Text>
          <Text style={[styles.metricValue, { color: colors.accent }]}>
            {t('habits.streakDays', { days: overall.bestCurrentStreak })}
          </Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={[styles.statLabel, { color: colors.muted }]}>{t('habits.bestStreak', { days: bestEver })}</Text>
          <Text style={[styles.metricValue, { color: colors.ink }]}>
            {`${overall.todayCompletedCount}/${overall.activeHabitCount}`}
          </Text>
        </View>
      </GlassSurface>

      <GlassSurface style={styles.panel} radius={28}>
        <Text style={[styles.panelTitle, { color: colors.ink }]}>{t('habits.streaksTitle')}</Text>
        {streakRows.map(({ habit, streak }) => (
          <View key={habit.id} style={styles.habitRow}>
            <View style={styles.habitCopy}>
              <Text style={[styles.habitTitle, { color: colors.ink }]} numberOfLines={1}>
                {habit.title}
              </Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>
                {`🔥 ${t('habits.streakDays', { days: streak.currentStreak })} · ${t('habits.bestStreak', { days: streak.bestStreak })}`}
              </Text>
            </View>
            <Text style={[styles.countWide, { color: colors.accent }]}>
              {`${Math.round(streak.consistencyRate30Days * 100)}%`}
            </Text>
          </View>
        ))}
      </GlassSurface>
    </View>
  );
}

/**
 * Purpose: Financial Pulse segment — net worth (optional), month spend vs budgets, top categories.
 * Inputs: FinanceProvider + Settings advanced-finance flag.
 * Outputs: presentation only.
 * Side effects: none.
 */
function FinancePanel() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const { settings } = useSettings();
  const { expenses, budgets, assets, loans } = useFinance();
  const { creditCards } = useReminders();
  const now = useMemo(() => new Date(), []);
  const currency = settings.defaultCurrency;
  const extrasOn = resolveShowAdvancedFinance(settings, assets.length > 0 || loans.length > 0);
  const expenseCatalog = useMemo(() => resolveExpenseCategories(settings), [settings]);

  const net = useMemo(
    () => computeNetWorth(assets, loans, creditCards, currency),
    [assets, loans, creditCards, currency],
  );

  const insight = useMemo(
    () => computeMonthSpendInsight(expenses, currency, now),
    [expenses, currency, now],
  );

  const budgetRows = useMemo(
    () => budgetProgressFor(budgets, expenses, now.getFullYear(), now.getMonth(), currency),
    [budgets, expenses, now, currency],
  );
  const overCount = budgetRows.filter((row) => row.over).length;
  const budgetAlert =
    overCount === 0
      ? t('alerts.budgetsFine')
      : overCount === 1
        ? t('alerts.budgetOverOne')
        : t('alerts.budgetsOver', { count: overCount });

  const topCategories = useMemo(() => {
    const year = now.getFullYear();
    const month = now.getMonth();
    const seen = new Set<ExpenseCategory>();
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    for (const item of expenses) {
      if (item.dayKey.startsWith(prefix)) {
        seen.add(item.category);
      }
    }
    return [...seen]
      .map((category) => ({
        category,
        amount: monthSpendTotal(expenses, year, month, currency, category),
      }))
      .filter((row) => row.amount > 0)
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 5);
  }, [expenses, now, currency]);

  const maxCategory = Math.max(1, ...topCategories.map((row) => row.amount));

  return (
    <View style={styles.panelStack}>
      {extrasOn ? (
        <GlassSurface style={styles.panel} radius={28}>
          <Text style={[styles.panelTitle, { color: colors.ink }]}>{t('you.netAssetLabel')}</Text>
          <Text style={[styles.statValue, { color: colors.accent }]}>
            {formatMoney(net.net, currency)}
          </Text>
          <Text style={[styles.empty, { color: colors.muted }]}>{budgetAlert}</Text>
        </GlassSurface>
      ) : null}

      <GlassSurface style={styles.panel} radius={28}>
        <Text style={[styles.panelTitle, { color: colors.ink }]}>{t('money.spentThisMonth')}</Text>
        <Text style={[styles.statValue, { color: colors.ink }]}>
          {formatMoney(insight.spent, currency)}
        </Text>
        {insight.changeLine ? (
          <Text style={[styles.empty, { color: colors.muted }]}>{insight.changeLine}</Text>
        ) : null}
        {budgetRows.length > 0 ? (
          <Text style={[styles.empty, { color: colors.muted }]}>{budgetAlert}</Text>
        ) : null}
      </GlassSurface>

      {budgetRows.length > 0 ? (
        <GlassSurface style={styles.panel} radius={28}>
          <Text style={[styles.panelTitle, { color: colors.ink }]}>{t('money.budgets')}</Text>
          {budgetRows.slice(0, 5).map((row) => {
            const limit = Math.max(1, row.budget.limit);
            const width = `${Math.min(100, Math.max(8, (row.spent / limit) * 100))}%` as `${number}%`;
            return (
              <View key={row.budget.id} style={styles.moodRow}>
                <TypeIcon
                  typeId={row.budget.category}
                  icon={iconForExpenseCategory(row.budget.category, expenseCatalog)}
                  accessibilityLabel={expenseCategoryLabel(t, row.budget.category, expenseCatalog)}
                />
                <View style={[styles.track, { backgroundColor: colors.well }]}>
                  <View
                    style={[
                      styles.fill,
                      { width, backgroundColor: row.over ? colors.danger : colors.accent },
                    ]}
                  />
                </View>
                <Text style={[styles.countWide, { color: colors.faint }]}>
                  {formatMoney(row.spent, currency)}
                </Text>
              </View>
            );
          })}
        </GlassSurface>
      ) : null}

      <GlassSurface style={styles.panel} radius={28}>
        <Text style={[styles.panelTitle, { color: colors.ink }]}>{t('money.categories')}</Text>
        {topCategories.length === 0 ? (
          <Text style={[styles.empty, { color: colors.muted }]}>{t('money.emptyMonth')}</Text>
        ) : (
          topCategories.map((row) => {
            const width = `${Math.max(12, (row.amount / maxCategory) * 100)}%` as `${number}%`;
            return (
              <View key={row.category} style={styles.moodRow}>
                <TypeIcon
                  typeId={row.category}
                  icon={iconForExpenseCategory(row.category, expenseCatalog)}
                  accessibilityLabel={expenseCategoryLabel(t, row.category, expenseCatalog)}
                />
                <View style={[styles.track, { backgroundColor: colors.well }]}>
                  <View style={[styles.fill, { width, backgroundColor: colors.accent }]} />
                </View>
                <Text style={[styles.countWide, { color: colors.faint }]}>
                  {formatMoney(row.amount, currency)}
                </Text>
              </View>
            );
          })
        )}
      </GlassSurface>
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
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  stat: {
    flex: 1,
    padding: 18,
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 32,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 4,
  },
  panel: {
    padding: 20,
    gap: 16,
  },
  panelTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  moodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  moodEmoji: {
    fontSize: 16,
    width: 24,
  },
  moodLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    width: 64,
    minWidth: 0,
    flexShrink: 1,
  },
  track: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: 10,
    borderRadius: 999,
  },
  count: {
    fontFamily: fonts.body,
    fontSize: 12,
    width: 18,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  countWide: {
    fontFamily: fonts.body,
    fontSize: 12,
    minWidth: 56,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricValue: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  habitCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  habitTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
  },
});
