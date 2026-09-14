import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFinance } from '../../controller/FinanceProvider';
import { useJournal } from '../../controller/JournalProvider';
import { useReminders } from '../../controller/ReminderProvider';
import { useSettings } from '../../controller/SettingsProvider';
import { computeWeeklyInsightsReport } from '../../model/insights/weeklyReport';
import { pickTodayPrediction } from '../../model/insights/predictions';
import { buildTodaySummary, type TodaySummaryLine } from '../../model/insights/todaySummary';
import { resolveWeekStart } from '../../model/settings/AppSettings';
import { nextUpCard } from '../../model/today/nextUp';
import { appHref } from '../../utils/navigation';
import { localizeTodayPrediction, useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, groupedRadius } from '../theme/tokens';
import { GlassSurface } from './GlassSurface';

/**
 * Purpose: localize one Today summary line (Model stays language-free).
 * Inputs: translator + TodaySummaryLine.
 * Outputs: display string.
 * Side effects: none.
 */
function localizeSummaryLine(
  t: (key: string, options?: Record<string, string | number>) => string,
  line: TodaySummaryLine,
): string {
  if (line.kind === 'pressure') {
    const key: Record<typeof line.pressure, string> = {
      quiet: 'insights.pressureQuiet',
      overdue: 'insights.pressureOverdue',
      budget: 'insights.pressureBudget',
      writing: 'insights.pressureWriting',
      habits: 'insights.pressureHabits',
      spendUp: 'insights.pressureSpendUp',
      worth: 'insights.pressureWorth',
      steady: 'insights.pressureSteady',
    };
    return t(key[line.pressure]);
  }
  if (line.kind === 'prediction') {
    return localizeTodayPrediction(t, line.prediction);
  }
  if (line.kind === 'writingDays') {
    return line.days === 1
      ? t('home.summaryWroteOne')
      : t('home.summaryWrote', { count: line.days });
  }
  return t('home.summaryHabits', { percent: line.percent });
}

/**
 * Purpose: href for a summary line tap.
 * Inputs: TodaySummaryLine.
 * Outputs: in-app path or null when the line is not a tap.
 * Side effects: none.
 */
function hrefForLine(line: TodaySummaryLine): string | null {
  if (line.kind === 'pressure') {
    return line.href;
  }
  if (line.kind === 'prediction') {
    return line.prediction.href;
  }
  if (line.kind === 'writingDays') {
    return '/(tabs)/journal';
  }
  return '/(tabs)/calendar?tab=streaks';
}

/**
 * Purpose: Today AI Summary — at most three rule-based lines from pressure / predictions / week facts.
 * Inputs: journal, reminders, finance, settings; buildTodaySummary in Model.
 * Outputs: compact Summary card, or nothing when Model returns [].
 * Side effects: tap navigates to the line’s hub.
 * Design decisions: omit the block when empty (do not invent). Max three short lines. Not a
 *   coach essay. Math stays in Model. Next Up stays the action; this is the glance note.
 */
export function TodaySummaryBlock() {
  const colors = useThemeColors();
  const router = useRouter();
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
  const lines = useMemo(
    () =>
      buildTodaySummary({
        pressure: report.pressure,
        prediction,
        daysWritten: report.daysWritten,
        habitHitRate: report.habitHitRate,
      }),
    [report.pressure, report.daysWritten, report.habitHitRate, prediction],
  );

  if (lines.length === 0) {
    return null;
  }

  return (
    <GlassSurface style={styles.card} radius={groupedRadius}>
      <Text style={[styles.kicker, { color: colors.accent }]}>{t('home.summary')}</Text>
      {lines.map((line, index) => {
        const copy = localizeSummaryLine(t, line);
        const href = hrefForLine(line);
        return (
          <Pressable
            key={`${line.kind}-${index}`}
            onPress={() => {
              if (href) {
                router.push(appHref(href));
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={copy}
            style={({ pressed }) => [styles.lineHit, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={[styles.line, { color: colors.ink }]} numberOfLines={2}>
              {copy}
            </Text>
          </Pressable>
        );
      })}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
    marginBottom: 14,
  },
  kicker: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  lineHit: {
    minHeight: 44,
    justifyContent: 'center',
  },
  line: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
  },
});
