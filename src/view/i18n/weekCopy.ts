import { formatFriendlyMoney } from '../../model/finance/Expense';
import type { WeeklyLifeSummary } from '../../model/life/weeklySummary';
import type { Translate } from './I18nProvider';

export interface WeeklyChipCopy {
  pagesValue: string;
  pagesCaption: string;
  moodValue: string;
  moodCaption: string;
  moodEmoji: string;
  spendValue: string;
  spendCaption: string;
  remindersValue: string;
  remindersCaption: string;
  isQuiet: boolean;
}

/**
 * Purpose: localize Today/You “This week” lines from Model counts (View-only strings).
 * Inputs: translator + weekly summary snapshot.
 * Outputs: compactCopy, journalLine, remindersLine, moneyLine.
 * Side effects: none.
 * Design decisions: Model keeps English fallbacks for tests; screens prefer these View strings.
 */
export function localizeWeeklySummary(t: Translate, week: WeeklyLifeSummary): {
  compactCopy: string;
  journalLine: string;
  remindersLine: string;
  moneyLine: string;
} {
  const moodLabel = week.topMood ? t(`mood.${week.topMood}`) : '';
  const categoryLabel = week.topCategory ? t(`types.${week.topCategory}`) : '';

  let compactCopy = t('week.quiet');
  if (week.entryCount > 0 || week.spendTotal > 0 || week.remindersCompleted > 0) {
    const bits: string[] = [];
    bits.push(
      week.entryCount === 1
        ? t('week.pageWrittenOne')
        : t('week.pagesWritten', { count: week.entryCount }),
    );
    if (moodLabel) {
      bits.push(`${week.topMoodEmoji} ${t('week.mostlyMood', { mood: moodLabel })}`);
    }
    if (week.spendTotal > 0) {
      bits.push(t('week.spent', { amount: formatFriendlyMoney(week.spendTotal, week.currency) }));
    }
    bits.push(
      week.remindersCompleted === 1
        ? t('week.reminderDoneOne')
        : t('week.remindersDone', { count: week.remindersCompleted }),
    );
    compactCopy = bits.join(' / ');
  }

  const journalBits: string[] = [
    week.daysWritten === 1 ? t('week.dayWrittenOne') : t('week.daysWritten', { count: week.daysWritten }),
    week.entryCount === 1 ? t('week.pageOne') : t('week.pages', { count: week.entryCount }),
  ];
  if (week.wordCount > 0) {
    journalBits.push(t('week.words', { count: week.wordCount }));
  }
  if (week.mostUsedTag) {
    journalBits.push(`#${week.mostUsedTag}`);
  }
  if (moodLabel) {
    journalBits.push(`${week.topMoodEmoji} ${moodLabel}`);
  }

  const reminderBits = [
    t('week.completed', { count: week.remindersCompleted }),
    t('week.remaining', { count: week.remindersRemaining }),
  ];
  if (week.remindersOverdue > 0) {
    reminderBits.push(t('week.overdue', { count: week.remindersOverdue }));
  }

  const moneyBits: string[] = [];
  if (week.spendTotal > 0) {
    moneyBits.push(formatFriendlyMoney(week.spendTotal, week.currency));
    if (categoryLabel) {
      moneyBits.push(categoryLabel);
    }
    if (week.largestExpense) {
      const note = week.largestExpense.note?.trim();
      const label = note || t(`types.${week.largestExpense.category}`);
      moneyBits.push(
        t('week.largest', {
          label,
          amount: formatFriendlyMoney(week.largestExpense.amount, week.largestExpense.currency),
        }),
      );
    }
  } else {
    moneyBits.push(t('week.nothingSpent'));
  }

  return {
    compactCopy,
    journalLine: journalBits.join(' · '),
    remindersLine: reminderBits.join(' · '),
    moneyLine: moneyBits.join(' · '),
  };
}

/**
 * Purpose: four tactile This week chip strings for the Today Home card.
 * Inputs: translator + weekly summary snapshot.
 * Outputs: value/caption pairs plus quiet flag.
 * Side effects: none.
 * Design decisions: short chip copy (“2 written”, “1 done”) — not the slash scan line.
 */
export function localizeWeeklyChips(t: Translate, week: WeeklyLifeSummary): WeeklyChipCopy {
  const moodLabel = week.topMood ? t(`mood.${week.topMood}`) : '';
  const isQuiet = week.entryCount === 0 && week.spendTotal === 0 && week.remindersCompleted === 0;
  return {
    pagesValue:
      week.entryCount === 1 ? t('week.chipPagesOne') : t('week.chipPages', { count: week.entryCount }),
    pagesCaption: t('week.chipPagesCaption'),
    moodValue: moodLabel ? t('week.mostlyMood', { mood: moodLabel }) : t('week.chipMoodEmpty'),
    moodCaption: t('week.chipMoodCaption'),
    moodEmoji: week.topMoodEmoji || '😐',
    spendValue:
      week.spendTotal > 0
        ? formatFriendlyMoney(week.spendTotal, week.currency)
        : t('week.chipSpendEmpty'),
    spendCaption: t('week.chipSpentCaption'),
    remindersValue:
      week.remindersCompleted === 1
        ? t('week.chipRemindersOne')
        : t('week.chipReminders', { count: week.remindersCompleted }),
    remindersCaption: t('week.chipRemindersCaption'),
    isQuiet,
  };
}
