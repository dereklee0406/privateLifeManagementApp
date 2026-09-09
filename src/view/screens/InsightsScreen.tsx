import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../../controller/FinanceProvider';
import { useJournal } from '../../controller/JournalProvider';
import { useReminders } from '../../controller/ReminderProvider';
import { useSettings } from '../../controller/SettingsProvider';
import { formatMoney } from '../../model/finance/Expense';
import { budgetProgressFor } from '../../model/finance/financeStats';
import { computeNetWorth } from '../../model/finance/netWorth';
import { resolveShowAdvancedFinance } from '../../model/settings/AppSettings';
import { computeLifeAreas } from '../../model/journal/lifeAreas';
import { getMoodDefinition } from '../../model/journal/Mood';
import { GlassSurface } from '../components/GlassSurface';
import { MoodTrendCharts } from '../components/MoodTrendCharts';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

/**
 * Purpose: show writing rhythm and mood climate without turning the journal into analytics theater.
 * Inputs: insights and moodAnalysis from journal context.
 * Outputs: aura canvas with 30-day Happy/Neutral/Stress summary and trend graphs.
 * Side effects: none.
 */
export function InsightsScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { insights, moodAnalysis, entries } = useJournal();
  const { settings } = useSettings();
  const { expenses, budgets, assets, loans } = useFinance();
  const { creditCards } = useReminders();
  const now = new Date();
  const extrasOn = resolveShowAdvancedFinance(settings, assets.length > 0 || loans.length > 0);
  const net = computeNetWorth(assets, loans, creditCards, settings.defaultCurrency);
  const budgetRows = budgetProgressFor(budgets, expenses, now.getFullYear(), now.getMonth(), settings.defaultCurrency);
  const overCount = budgetRows.filter((row) => row.over).length;
  const maxMood = Math.max(1, ...insights.moodShares.map((share) => share.count));
  const lifeAreas = computeLifeAreas(entries);
  const budgetAlert =
    overCount === 0
      ? t('alerts.budgetsFine')
      : overCount === 1
        ? t('alerts.budgetOverOne')
        : t('alerts.budgetsOver', { count: overCount });

  return (
    <ScreenScaffold>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.ink }]}>{t('you.howYouveBeen')}</Text>
        <Text style={[styles.lede, { color: colors.muted }]}>{t('you.insightsLede')}</Text>

        {extrasOn ? (
          <GlassSurface style={styles.panel} radius={28}>
            <Text style={[styles.panelTitle, { color: colors.ink }]}>{t('you.netAssetLabel')}</Text>
            <Text style={[styles.statValue, { color: colors.accent }]}>
              {formatMoney(net.net, settings.defaultCurrency)}
            </Text>
            <Text style={[styles.empty, { color: colors.muted }]}>{budgetAlert}</Text>
          </GlassSurface>
        ) : null}

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

        <MoodTrendCharts
          last30Days={moodAnalysis.last30Days}
          daily={moodAnalysis.daily}
          weekly={moodAnalysis.weekly}
          monthly={moodAnalysis.monthly}
        />

        <GlassSurface style={styles.panel} radius={28}>
          <Text style={[styles.panelTitle, { color: colors.ink }]}>{t('you.moodClimate')}</Text>
          {insights.moodShares.length === 0 ? (
            <Text style={[styles.empty, { color: colors.muted }]}>{t('you.noPagesClimate')}</Text>
          ) : (
            insights.moodShares.map((share) => {
              const mood = getMoodDefinition(share.mood);
              const width = `${Math.max(12, (share.count / maxMood) * 100)}%` as `${number}%`;
              return (
                <View key={share.mood} style={styles.moodRow}>
                  <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                  <Text style={[styles.moodLabel, { color: colors.muted }]}>{t(`mood.${share.mood}`)}</Text>
                  <View style={[styles.track, { backgroundColor: colors.well }]}>
                    <View style={[styles.fill, { width, backgroundColor: colors.mood[share.mood] }]} />
                  </View>
                  <Text style={[styles.count, { color: colors.faint }]}>{share.count}</Text>
                </View>
              );
            })
          )}
        </GlassSurface>
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 22,
    gap: 14,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 40,
  },
  lede: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
    marginBottom: 10,
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
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 4,
  },
  panel: {
    padding: 20,
    gap: 16,
    marginTop: 4,
  },
  panelTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: 15,
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
  },
});
