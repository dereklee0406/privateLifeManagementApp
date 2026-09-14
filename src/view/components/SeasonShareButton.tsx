import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { canCaptureMonthCard, captureAndShareMonthCard, shareMonthCardText } from '../../data/shareMonthCard';
import type { SeasonShareFacts } from '../../model/season/seasonShare';
import type { PillarStatus, SeasonPillarId } from '../../model/season/seasonRank';
import { hapticLight } from '../../utils/haptics';
import { localizeSeasonRank, useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, raisedSurface } from '../theme/tokens';
import { SeasonShareCard, seasonCardPlainText } from './SeasonShareCard';

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
 * Purpose: Share Season — native PNG via view-shot; web text or Save on phone.
 * Inputs: SeasonShareFacts; optional icon-only chrome for Today Life Score.
 * Outputs: 44pt share control + off-screen card (native capture).
 * Side effects: OS share sheet or clipboard; Alert on web when capture is impossible.
 * Design decisions: reuses shareMonthCard native/web helpers (never uploads). Same pattern
 *   as MonthlyReportShareButton. Icon variant sits on Today without a fifth block.
 */
export function SeasonShareButton({
  facts,
  variant = 'button',
}: {
  facts: SeasonShareFacts;
  variant?: 'button' | 'icon';
}) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
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
  const filename = 'halo-season.png';
  const summary = seasonCardPlainText({
    brand: t('insights.cardBrand'),
    lifeScore: t('season.lifeScore'),
    rank: rankLabel,
    score: String(facts.score),
    trendLine,
    nudgeLine,
    pillarLines: facts.pillars.map(
      (pillar) => `${t(PILLAR_KEY[pillar.id])} · ${t(STATUS_KEY[pillar.status])}`,
    ),
  });

  const onShare = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    void hapticLight();
    try {
      if (canCaptureMonthCard) {
        await captureAndShareMonthCard(cardRef, filename);
        return;
      }
      const result = await shareMonthCardText(summary);
      if (result === 'copied') {
        Alert.alert(t('season.shareCopied'));
        return;
      }
      if (result === 'unsupported') {
        Alert.alert(t('insights.saveOnPhone'));
      }
    } catch {
      Alert.alert(t('insights.saveOnPhone'), t('season.shareFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      {canCaptureMonthCard ? (
        <View
          ref={cardRef}
          collapsable={false}
          pointerEvents="none"
          style={styles.offscreen}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <SeasonShareCard facts={facts} />
        </View>
      ) : null}
      <Pressable
        onPress={() => void onShare()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t('season.shareA11y')}
        style={({ pressed }) =>
          variant === 'icon'
            ? [
                raisedSurface(colors, 14),
                styles.iconButton,
                { opacity: busy ? 0.5 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] },
              ]
            : [
                raisedSurface(colors, 22),
                styles.button,
                { opacity: busy ? 0.5 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]
        }
      >
        <Ionicons name="share-outline" size={20} color={colors.accent} accessible={false} />
        {variant === 'button' ? (
          <Text style={[styles.label, { color: colors.ink }]}>{t('season.share')}</Text>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    left: -10000,
    top: 0,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    lineHeight: 22,
  },
});
