import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFinance } from '../../controller/FinanceProvider';
import { useJournal } from '../../controller/JournalProvider';
import { useReminders } from '../../controller/ReminderProvider';
import { useSettings } from '../../controller/SettingsProvider';
import { computeSeasonRank, presentSeasonPillars, type SeasonPillarId } from '../../model/season/seasonRank';
import { appHref } from '../../utils/navigation';
import { localizeSeasonRank, useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, groupedRadius, insetSurface } from '../theme/tokens';
import { GlassSurface } from './GlassSurface';

const PILLAR_KEY: Record<SeasonPillarId, string> = {
  writing: 'insights.pillarWriting',
  habits: 'insights.pillarHabits',
  budget: 'insights.pillarBudget',
};

/**
 * Purpose: compact Today Season hero — the one life score above the fold.
 * Inputs: journal / reminders / finance / settings; computeSeasonRank + presentSeasonPillars in Model.
 * Outputs: rank + 0–100 meter + present-only pillar ticks (presentation only).
 * Side effects: tap navigates to Insights This month.
 * Design decisions: condensed InsightsSeasonHero, not the Insights glance grid. Missing habit/budget
 *   pillars are omitted, never greyed-in. Score stays derived in Model. Clay meter, not an XP bar.
 *   Replaces the muted TodaySeasonMark line so Season is glanceable in one tap.
 */
export function TodaySeasonHero() {
  const colors = useThemeColors();
  const router = useRouter();
  const { t } = useI18n();
  const { entries } = useJournal();
  const { reminders } = useReminders();
  const { expenses, budgets } = useFinance();
  const { settings } = useSettings();
  const now = useMemo(
    () => new Date(),
    [entries.length, reminders.length, expenses.length, budgets.length],
  );
  const season = useMemo(
    () => computeSeasonRank(entries, reminders, budgets, expenses, settings.defaultCurrency, now),
    [entries, reminders, budgets, expenses, settings.defaultCurrency, now],
  );
  const rankLabel = localizeSeasonRank(t, season.rank);
  const score = Math.round(season.score * 100);
  const pillars = presentSeasonPillars(season);

  return (
    <Pressable
      onPress={() => router.push(appHref('/(tabs)/insights?segment=month'))}
      accessibilityRole="button"
      accessibilityLabel={t('season.heroA11y', { rank: rankLabel, score })}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <GlassSurface style={styles.hero} radius={groupedRadius}>
        <View style={styles.rankRow} accessibilityElementsHidden>
          <View style={styles.rankCopy}>
            <Text style={[styles.kicker, { color: colors.accent }]}>{t('season.label')}</Text>
            <Text style={[styles.rank, { color: colors.ink }]} numberOfLines={1}>
              {rankLabel}
            </Text>
          </View>
          <Text style={[styles.score, { color: colors.ink }]}>{score}</Text>
        </View>
        <View style={[insetSurface(colors, 8), styles.meterTrack]} accessibilityElementsHidden>
          <View style={[styles.meterFill, { width: `${Math.max(4, score)}%`, backgroundColor: colors.accent }]} />
        </View>
        <View style={styles.ticks} accessibilityElementsHidden>
          {pillars.map((pillar) => {
            const percent = Math.round(pillar.rate * 100);
            return (
              <View key={pillar.id} style={styles.tick}>
                <Text style={[styles.tickLabel, { color: colors.muted }]} numberOfLines={1}>
                  {t(PILLAR_KEY[pillar.id])}
                </Text>
                <View style={[insetSurface(colors, 4), styles.tickTrack]}>
                  <View
                    style={[
                      styles.tickFill,
                      { width: `${Math.max(8, percent)}%`, backgroundColor: colors.accent },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 14,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  rankCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  kicker: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  rank: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
  },
  score: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  meterTrack: {
    height: 6,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 6,
    minWidth: 6,
  },
  ticks: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  tick: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  tickLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  tickTrack: {
    height: 4,
    overflow: 'hidden',
  },
  tickFill: {
    height: '100%',
    borderRadius: 4,
    minWidth: 4,
  },
});
