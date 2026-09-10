import { StyleSheet, Text, View } from 'react-native';
import { presentSeasonPillars, type SeasonPillarId, type SeasonRank } from '../../model/season/seasonRank';
import { localizeSeasonRank, useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface } from '../theme/tokens';
import { GlassSurface } from './GlassSurface';

const PILLAR_KEY: Record<SeasonPillarId, string> = {
  writing: 'insights.pillarWriting',
  habits: 'insights.pillarHabits',
  budget: 'insights.pillarBudget',
};

/**
 * Purpose: Insights Season hero — rank mark, composite meter, present pillars only.
 * Inputs: SeasonRank from Model; optional month hint.
 * Outputs: one raised board-pack header (presentation only).
 * Side effects: none.
 * Design decisions: missing habit/budget pillars are omitted, never greyed-in at 50%.
 *   Score is 0–100 tabular. Meter is an inset clay well, not an XP bar.
 */
export function InsightsSeasonHero({
  season,
  hint = false,
}: {
  season: SeasonRank;
  hint?: boolean;
}) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const rankLabel = localizeSeasonRank(t, season.rank);
  const score = Math.round(season.score * 100);
  const pillars = presentSeasonPillars(season);

  return (
    <GlassSurface style={styles.hero} radius={28}>
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={t('insights.heroA11y', { rank: rankLabel, score })}
        style={styles.heroInner}
      >
        <Text style={[styles.kicker, { color: colors.accent }]}>{t('season.label')}</Text>
        <View style={styles.rankRow}>
          <Text style={[styles.rank, { color: colors.ink }]}>{rankLabel}</Text>
          <Text style={[styles.score, { color: colors.ink }]}>{score}</Text>
        </View>
        <View style={[insetSurface(colors, 8), styles.meterTrack]} accessibilityElementsHidden>
          <View style={[styles.meterFill, { width: `${Math.max(4, score)}%`, backgroundColor: colors.accent }]} />
        </View>
        <View style={styles.pillars}>
          {pillars.map((pillar) => {
            const percent = Math.round(pillar.rate * 100);
            return (
              <View key={pillar.id} style={styles.pillarRow}>
                <Text style={[styles.pillarLabel, { color: colors.muted }]}>{t(PILLAR_KEY[pillar.id])}</Text>
                <View style={[insetSurface(colors, 6), styles.pillarTrack]}>
                  <View
                    style={[
                      styles.pillarFill,
                      { width: `${Math.max(6, percent)}%`, backgroundColor: colors.accent },
                    ]}
                  />
                </View>
                <Text style={[styles.pillarPct, { color: colors.ink }]}>{percent}%</Text>
              </View>
            );
          })}
        </View>
        {hint ? <Text style={[styles.hint, { color: colors.muted }]}>{t('insights.seasonHint')}</Text> : null}
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  heroInner: {
    gap: 12,
  },
  kicker: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  rank: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    flex: 1,
    minWidth: 0,
  },
  score: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  meterTrack: {
    height: 8,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 8,
    minWidth: 8,
  },
  pillars: {
    gap: 10,
    marginTop: 4,
  },
  pillarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pillarLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    width: 78,
  },
  pillarTrack: {
    flex: 1,
    height: 8,
    overflow: 'hidden',
    minWidth: 44,
  },
  pillarFill: {
    height: '100%',
    borderRadius: 6,
    minWidth: 6,
  },
  pillarPct: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    width: 40,
    textAlign: 'right',
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
});
