import { StyleSheet, Text, View } from 'react-native';
import type { MonthlyShareFacts } from '../../model/insights/monthlyShare';
import { localizeMonthlyInsights, localizeSeasonRank, useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

/**
 * Purpose: format YYYY-MM as a long month name for the share card.
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
 * Purpose: dedicated month board for view-shot (Halo, Season, pack lines, pressure).
 * Inputs: MonthlyShareFacts from Model; presentation only.
 * Outputs: fixed-width clay card.
 * Side effects: none.
 * Design decisions: no live lists. Copy reuses Insights localizers. Nothing uploaded.
 */
export function MonthlyReportCard({ facts }: { facts: MonthlyShareFacts }) {
  const colors = useThemeColors();
  const { t, intlLocale } = useI18n();
  const copy = localizeMonthlyInsights(t, {
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
  });
  const rankLabel = localizeSeasonRank(t, facts.seasonRank);
  const monthName = formatShareMonth(facts.monthKey, intlLocale);

  return (
    <View style={[styles.card, { backgroundColor: colors.paper, borderColor: colors.glassBorder }]}>
      <Text style={[styles.brand, { color: colors.accent }]}>{t('insights.cardBrand')}</Text>
      <Text style={[styles.month, { color: colors.ink }]}>{monthName}</Text>
      <Text style={[styles.season, { color: colors.muted }]}>
        {t('season.mark', { rank: rankLabel })}
      </Text>
      <View style={styles.lines}>
        <Text style={[styles.body, { color: colors.ink }]}>{copy.pagesLine}</Text>
        <Text style={[styles.body, { color: colors.ink }]}>{copy.habitLine}</Text>
        <Text style={[styles.body, { color: colors.ink }]}>{copy.spendCompareLine}</Text>
        <Text style={[styles.body, { color: colors.ink }]}>{copy.netWorthLine}</Text>
      </View>
      <Text style={[styles.pressureLabel, { color: colors.accent }]}>{t('insights.pressureLabel')}</Text>
      <Text style={[styles.body, { color: colors.muted }]}>{copy.pressureLine}</Text>
    </View>
  );
}

/**
 * Purpose: web / clipboard fallback — one plain-text month summary.
 * Inputs: facts + already-localized Insights lines + Season + month name.
 * Outputs: text/plain block.
 * Side effects: none.
 */
export function monthCardPlainText(input: {
  brand: string;
  monthName: string;
  seasonLine: string;
  pagesLine: string;
  habitLine: string;
  spendLine: string;
  netWorthLine: string;
  pressureLabel: string;
  pressureLine: string;
}): string {
  return [
    input.brand,
    input.monthName,
    input.seasonLine,
    input.pagesLine,
    input.habitLine,
    input.spendLine,
    input.netWorthLine,
    `${input.pressureLabel}: ${input.pressureLine}`,
  ].join('\n');
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
  month: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 38,
  },
  season: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
  },
  lines: {
    gap: 8,
    marginBottom: 8,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
  },
  pressureLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    letterSpacing: 0.4,
    marginTop: 4,
  },
});
