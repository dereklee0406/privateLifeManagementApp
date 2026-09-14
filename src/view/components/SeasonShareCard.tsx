import { StyleSheet, Text, View } from 'react-native';
import type { SeasonShareFacts } from '../../model/season/seasonShare';
import type { PillarStatus, SeasonPillarId } from '../../model/season/seasonRank';
import { localizeSeasonRank, useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

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
 * Purpose: dedicated Season board for view-shot (rank, score, present pillars, optional trend).
 * Inputs: SeasonShareFacts from Model; presentation only.
 * Outputs: fixed-width clay card.
 * Side effects: none.
 * Design decisions: same capture path as MonthlyReportCard. No lists. Nothing uploaded.
 */
export function SeasonShareCard({ facts }: { facts: SeasonShareFacts }) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const rankLabel = localizeSeasonRank(t, facts.rank);
  const trendLine =
    facts.trend === null
      ? null
      : facts.trend.direction === 'up'
        ? t('season.trendUp', { points: facts.trend.points })
        : facts.trend.direction === 'down'
          ? t('season.trendDown', { points: Math.abs(facts.trend.points) })
          : t('season.trendFlat');
  const nudgeLine =
    facts.nudge === null
      ? null
      : t('season.nudge', { points: facts.nudge.points, rank: localizeSeasonRank(t, facts.nudge.nextRank) });

  return (
    <View style={[styles.card, { backgroundColor: colors.paper, borderColor: colors.glassBorder }]}>
      <Text style={[styles.brand, { color: colors.accent }]}>{t('insights.cardBrand')}</Text>
      <Text style={[styles.kicker, { color: colors.accent }]}>{t('season.lifeScore')}</Text>
      <Text style={[styles.rank, { color: colors.ink }]}>{rankLabel}</Text>
      <Text style={[styles.score, { color: colors.ink }]}>{facts.score}</Text>
      {trendLine ? (
        <Text style={[styles.body, { color: colors.muted }]}>{trendLine}</Text>
      ) : null}
      {nudgeLine ? (
        <Text style={[styles.body, { color: colors.muted }]}>{nudgeLine}</Text>
      ) : null}
      <View style={styles.lines}>
        {facts.pillars.map((pillar) => (
          <Text key={pillar.id} style={[styles.body, { color: colors.ink }]}>
            {t(PILLAR_KEY[pillar.id])} · {t(STATUS_KEY[pillar.status])}
          </Text>
        ))}
      </View>
    </View>
  );
}

/**
 * Purpose: web / clipboard fallback — one plain-text Season summary.
 * Inputs: already-localized lines.
 * Outputs: text/plain block.
 * Side effects: none.
 */
export function seasonCardPlainText(input: {
  brand: string;
  lifeScore: string;
  rank: string;
  score: string;
  trendLine: string | null;
  nudgeLine: string | null;
  pillarLines: string[];
}): string {
  return [
    input.brand,
    input.lifeScore,
    `${input.rank} · ${input.score}`,
    input.trendLine,
    input.nudgeLine,
    ...input.pillarLines,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

const styles = StyleSheet.create({
  card: {
    width: 360,
    padding: 28,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 28,
  },
  brand: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  kicker: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  rank: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 38,
  },
  score: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 34,
    fontVariant: ['tabular-nums'],
  },
  lines: {
    gap: 8,
    marginTop: 8,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
  },
});
