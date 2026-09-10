import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { canCaptureMonthCard, captureAndShareMonthCard, shareMonthCardText } from '../../data/shareMonthCard';
import type { MonthlyShareFacts } from '../../model/insights/monthlyShare';
import { hapticLight } from '../../utils/haptics';
import { localizeMonthlyInsights, localizeSeasonRank, useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, raisedSurface } from '../theme/tokens';
import { MonthlyReportCard, monthCardPlainText } from './MonthlyReportCard';

/**
 * Purpose: format YYYY-MM as a long month name for the share filename / text.
 * Inputs: monthKey, Intl locale.
 * Outputs: e.g. September 2026.
 * Side effects: none.
 */
function formatShareMonth(monthKey: string, locale: string): string {
  const [yearRaw, monthRaw] = monthKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return monthKey;
  }
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  );
}

/**
 * Purpose: Insights This month share — native PNG via view-shot; web text or Save on phone.
 * Inputs: MonthlyShareFacts.
 * Outputs: 44pt share button + off-screen card (native capture).
 * Side effects: OS share sheet or clipboard; Alert on web when capture is impossible.
 * Design decisions: backupIO never uploads; this path is the same. Card is off-screen.
 */
export function MonthlyReportShareButton({ facts }: { facts: MonthlyShareFacts }) {
  const colors = useThemeColors();
  const { t, intlLocale } = useI18n();
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const copy = useMemo(() => localizeMonthlyInsights(t, {
    pageCount: facts.pageCount,
    writingDays: facts.writingDays,
    wordCount: 0,
    habitHitRate: facts.habitPercent === null ? null : facts.habitPercent / 100,
    activeHabitCount: 0,
    spent: facts.spent,
    previousSpent: 0,
    spendPercentChange: facts.spendPercentChange,
    hasPreviousSpend: facts.hasPreviousSpend,
    currency: facts.currency,
    budgetOverCount: 0,
    budgetCount: 0,
    netWorthDelta: facts.netWorthDelta,
    hasNetWorthSnapshot: facts.hasNetWorthSnapshot,
    pressure: facts.pressure,
  }), [t, facts]);
  const rankLabel = localizeSeasonRank(t, facts.seasonRank);
  const monthName = formatShareMonth(facts.monthKey, intlLocale);
  const filename = `halo-month-${facts.monthKey}.png`;
  const summary = monthCardPlainText({
    brand: t('insights.cardBrand'),
    monthName,
    seasonLine: t('season.mark', { rank: rankLabel }),
    pagesLine: copy.pagesLine,
    habitLine: copy.habitLine,
    spendLine: copy.spendCompareLine,
    netWorthLine: copy.netWorthLine,
    pressureLabel: t('insights.pressureLabel'),
    pressureLine: copy.pressureLine,
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
        Alert.alert(t('insights.shareCopied'));
        return;
      }
      if (result === 'unsupported') {
        Alert.alert(t('insights.saveOnPhone'));
      }
    } catch {
      Alert.alert(t('insights.saveOnPhone'), t('insights.shareFailed'));
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
          <MonthlyReportCard facts={facts} />
        </View>
      ) : null}
      <Pressable
        onPress={() => void onShare()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t('insights.shareMonthA11y')}
        style={({ pressed }) => [
          raisedSurface(colors, 22),
          styles.button,
          { opacity: busy ? 0.5 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        ]}
      >
        <Ionicons name="share-outline" size={20} color={colors.accent} accessible={false} />
        <Text style={[styles.label, { color: colors.ink }]}>{t('insights.shareMonth')}</Text>
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
