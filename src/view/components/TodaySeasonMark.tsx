import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useFinance } from '../../controller/FinanceProvider';
import { useJournal } from '../../controller/JournalProvider';
import { useReminders } from '../../controller/ReminderProvider';
import { useSettings } from '../../controller/SettingsProvider';
import { computeSeasonRank } from '../../model/season/seasonRank';
import { appHref } from '../../utils/navigation';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

/**
 * Purpose: one-line Season mark on Today — rank only, not a second hero.
 * Inputs: journal / reminders / finance / settings; computeSeasonRank in Model.
 * Outputs: compact “Season · Forge” line under the greeting. Spark still shows.
 * Side effects: navigates to Insights This month.
 * Design decisions: no card, no XP bar. Next Up stays the hero. Tap opens Insights, not a game loop.
 */
export function TodaySeasonMark() {
  const colors = useThemeColors();
  const router = useRouter();
  const { t } = useI18n();
  const { entries } = useJournal();
  const { reminders } = useReminders();
  const { expenses, budgets } = useFinance();
  const { settings } = useSettings();
  const now = useMemo(() => new Date(), [entries.length, reminders.length, expenses.length, budgets.length]);
  const season = useMemo(
    () => computeSeasonRank(entries, reminders, budgets, expenses, settings.defaultCurrency, now),
    [entries, reminders, budgets, expenses, settings.defaultCurrency, now],
  );
  const rankLabel = t(`season.${season.rank}`);

  return (
    <Pressable
      onPress={() => router.push(appHref('/(tabs)/insights?segment=month'))}
      accessibilityRole="button"
      accessibilityLabel={t('season.markA11y', { rank: rankLabel })}
      hitSlop={8}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <Text style={[styles.mark, { color: colors.muted }]}>{t('season.mark', { rank: rankLabel })}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mark: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
});
