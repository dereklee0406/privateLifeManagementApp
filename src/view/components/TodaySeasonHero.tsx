import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFinance } from '../../controller/FinanceProvider';
import { useJournal } from '../../controller/JournalProvider';
import { useReminders } from '../../controller/ReminderProvider';
import { useSettings } from '../../controller/SettingsProvider';
import {
  computeSeasonRank,
  computeSeasonTrend,
  pillarStatus,
  pointsToNextRank,
  presentSeasonPillars,
  type PillarStatus,
  type SeasonPillarId,
} from '../../model/season/seasonRank';
import { buildSeasonShareFacts } from '../../model/season/seasonShare';
import { appHref } from '../../utils/navigation';
import { localizeSeasonRank, useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, groupedRadius, insetSurface } from '../theme/tokens';
import { GlassSurface } from './GlassSurface';
import { SeasonShareButton } from './SeasonShareButton';

const PILLAR_KEY: Record<SeasonPillarId, string> = {
  writing: 'season.pillarProductivity',
  habits: 'insights.pillarHabits',
  budget: 'season.pillarFinance',
};

const STATUS_KEY: Record<PillarStatus, string> = {
  good: 'season.pillarGood',
  attention: 'season.pillarAttention',
  critical: 'season.pillarCritical',
};

/**
 * Purpose: compact Today Life Score — Season 0–100, optional week trend, rank, present pillar ticks.
 * Inputs: journal / reminders / finance / settings; computeSeasonRank + computeSeasonTrend + pillarStatus in Model.
 * Outputs: rank + meter + Good / Needs attention / Critical ticks, next-rank nudge, share.
 * Side effects: score/rank (and meter/ticks) tap navigates to Insights This month; share opens OS sheet (never uploads).
 * Design decisions: Health/Learning omitted (no data — do not fake). Missing habit/budget pillars
 *   omitted. Trend is week-ago Season recompute; omitted when both scores are 0. Nudge is hidden
 *   at Steel. Clay meter, not XP. Share reuses the month-card view-shot path. Card is a View —
 *   Insights Pressable and Share Pressable are siblings so web does not nest <button>.
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
  const trend = useMemo(
    () => computeSeasonTrend(entries, reminders, budgets, expenses, settings.defaultCurrency, now),
    [entries, reminders, budgets, expenses, settings.defaultCurrency, now],
  );
  const rankLabel = localizeSeasonRank(t, season.rank);
  const score = Math.round(season.score * 100);
  const pillars = presentSeasonPillars(season);
  const nudge = pointsToNextRank(season.score);
  const shareFacts = useMemo(() => buildSeasonShareFacts(season, trend), [season, trend]);
  const nudgeLine =
    nudge === null ? null : t('season.nudge', { points: nudge.points, rank: localizeSeasonRank(t, nudge.nextRank) });
  const trendLine =
    trend === null
      ? null
      : trend.direction === 'up'
        ? t('season.trendUp', { points: trend.points })
        : trend.direction === 'down'
          ? t('season.trendDown', { points: Math.abs(trend.points) })
          : t('season.trendFlat');

  const openInsights = () => router.push(appHref('/(tabs)/insights?segment=month'));

  return (
    <GlassSurface style={styles.hero} radius={groupedRadius}>
      <View style={styles.rankRow}>
        <Pressable
          onPress={openInsights}
          accessibilityRole="button"
          accessibilityLabel={t('season.heroA11y', { rank: rankLabel, score })}
          style={({ pressed }) => [styles.rankHit, { opacity: pressed ? 0.85 : 1 }]}
        >
          <View style={styles.rankCopy} accessibilityElementsHidden>
            <Text style={[styles.kicker, { color: colors.accent }]}>{t('season.lifeScore')}</Text>
            <Text style={[styles.rank, { color: colors.ink }]} numberOfLines={1}>
              {rankLabel}
            </Text>
          </View>
          <Text style={[styles.score, { color: colors.ink }]} accessibilityElementsHidden>
            {score}
          </Text>
        </Pressable>
        <SeasonShareButton facts={shareFacts} variant="icon" />
      </View>
      <Pressable
        onPress={openInsights}
        accessible={false}
        style={({ pressed }) => [styles.restHit, { opacity: pressed ? 0.85 : 1 }]}
      >
        <View style={[insetSurface(colors, 8), styles.meterTrack]} accessibilityElementsHidden>
          <View style={[styles.meterFill, { width: `${Math.max(4, score)}%`, backgroundColor: colors.accent }]} />
        </View>
        {trendLine ? (
          <Text style={[styles.trend, { color: colors.muted }]} numberOfLines={1}>
            {trendLine}
          </Text>
        ) : null}
        {nudgeLine ? (
          <Text style={[styles.trend, { color: colors.muted }]} numberOfLines={1}>
            {nudgeLine}
          </Text>
        ) : null}
        <View style={styles.ticks} accessibilityElementsHidden>
          {pillars.map((pillar) => {
            const status = pillarStatus(pillar.rate);
            const statusColor =
              status === 'critical' ? colors.danger : status === 'attention' ? colors.muted : colors.accent;
            return (
              <View key={pillar.id} style={styles.tick}>
                <Text style={[styles.tickLabel, { color: colors.muted }]} numberOfLines={1}>
                  {t(PILLAR_KEY[pillar.id])}
                </Text>
                <Text style={[styles.tickStatus, { color: statusColor }]} numberOfLines={1}>
                  {t(STATUS_KEY[status])}
                </Text>
              </View>
            );
          })}
        </View>
      </Pressable>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rankHit: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rankCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  restHit: {
    gap: 8,
  },
  kicker: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  rank: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 26,
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
  trend: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  ticks: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  tick: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  tickLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  tickStatus: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    lineHeight: 16,
  },
});
