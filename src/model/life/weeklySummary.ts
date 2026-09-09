import type { Expense, ExpenseCategory } from '../finance/Expense';
import { EXPENSE_CATEGORIES, formatFriendlyMoney } from '../finance/Expense';
import { previousDayOfMonth, nextOrSameDayOfMonth, civilDaysBetween } from '../finance/cardHealth';
import type { JournalEntry } from '../journal/JournalEntry';
import { getMoodDefinition, type MoodId } from '../journal/Mood';
import { computeWritingDaysThisWeek, startOfLocalDay } from '../journal/journalStats';
import { nextFireAt } from '../reminders/nextFire';
import type { Reminder } from '../reminders/Reminder';
import type { CreditCardAccount } from '../reminders/creditCards';
import type { MoneyCurrency, WeekStart } from '../settings/AppSettings';
import { toDayKey } from '../../utils/dateUtils';
import { thisCalendarWeek, thisWeekSoFar } from './weekBounds';
import { spendInDayRange } from '../today/todayGlance';
import { spendAmountIn } from '../finance/fx';
import { onceFireAt } from '../today/nextUp';

export interface WeeklyLifeSummary {
  daysWritten: number;
  entryCount: number;
  wordCount: number;
  mostUsedTag: string | null;
  topMood: MoodId | null;
  topMoodLabel: string;
  topMoodEmoji: string;
  spendTotal: number;
  topCategory: ExpenseCategory | null;
  topCategoryLabel: string;
  largestExpense: Expense | null;
  currency: MoneyCurrency;
  remindersCompleted: number;
  remindersRemaining: number;
  remindersOverdue: number;
  compactCopy: string;
  journalLine: string;
  remindersLine: string;
  moneyLine: string;
  /** @deprecated use compactCopy — kept so existing screens keep compiling during the swap. */
  copy: string;
}

/**
 * Purpose: count reminder fires that already happened in [from, to] (inclusive instants).
 * Inputs: one reminder and a closed time window.
 * Outputs: how many times it fired in that window.
 * Side effects: none.
 * Design decisions: once-reminders use their civil day + clock; recurrences walk nextFireAt so we do not invent a “completed” flag.
 */
export function countReminderFiresInRange(reminder: Reminder, from: Date, to: Date): number {
  if (reminder.recurrence.type === 'once') {
    const [year, month, day] = reminder.recurrence.dayKey.split('-').map(Number);
    if (!year || !month || !day) {
      return 0;
    }
    const fire = new Date(year, month - 1, day, reminder.hour, reminder.minute, 0, 0);
    return fire.getTime() >= from.getTime() && fire.getTime() <= to.getTime() ? 1 : 0;
  }
  let count = 0;
  let cursor = new Date(from.getTime() - 1000);
  for (let i = 0; i < 16; i += 1) {
    const next = nextFireAt(reminder, cursor);
    if (!next || next.getTime() > to.getTime()) {
      break;
    }
    if (next.getTime() >= from.getTime()) {
      count += 1;
    }
    cursor = new Date(next.getTime() + 1000);
  }
  return count;
}

/**
 * Purpose: most common mood among pages written this week so far.
 * Inputs: entries and now.
 * Outputs: mood id or null when she has not written.
 * Side effects: none.
 */
export function topMoodThisWeek(
  entries: JournalEntry[],
  now: Date = new Date(),
  weekStartsOn: WeekStart = 'monday',
): MoodId | null {
  const week = thisWeekSoFar(now, weekStartsOn);
  const counts = new Map<MoodId, number>();
  for (const entry of entries) {
    const key = toDayKey(new Date(entry.createdAt));
    if (key < week.startKey || key > week.endKey) {
      continue;
    }
    counts.set(entry.mood, (counts.get(entry.mood) ?? 0) + 1);
  }
  let best: MoodId | null = null;
  let bestCount = 0;
  for (const [mood, count] of counts) {
    if (count > bestCount) {
      best = mood;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Purpose: pages whose civil day sits in this week so far.
 * Inputs: entries and now.
 * Outputs: matching pages.
 * Side effects: none.
 */
export function entriesThisWeek(
  entries: JournalEntry[],
  now: Date = new Date(),
  weekStartsOn: WeekStart = 'monday',
): JournalEntry[] {
  const week = thisWeekSoFar(now, weekStartsOn);
  return entries.filter((entry) => {
    const key = toDayKey(new Date(entry.createdAt));
    return key >= week.startKey && key <= week.endKey;
  });
}

/**
 * Purpose: most-used tag slug among this week’s pages.
 * Inputs: week entries.
 * Outputs: slug or null.
 * Side effects: none.
 */
export function mostUsedTagOf(entries: JournalEntry[]): string | null {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const tag of entry.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [tag, count] of counts) {
    if (count > bestCount) {
      best = tag;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Purpose: Today compact This week line — pages / mood / spend / reminders done.
 * Inputs: summary bits.
 * Outputs: slash-separated scan line, or a quiet-week sentence.
 * Side effects: none.
 */
export function weeklyLifeCompactCopy(input: {
  entryCount: number;
  topMoodEmoji: string;
  topMoodLabel: string;
  spendTotal: number;
  currency: MoneyCurrency;
  remindersCompleted: number;
}): string {
  const { entryCount, topMoodEmoji, topMoodLabel, spendTotal, currency, remindersCompleted } = input;
  if (entryCount === 0 && spendTotal === 0 && remindersCompleted === 0) {
    return 'A quiet week so far. Write a page or log a coffee when you want.';
  }
  const bits: string[] = [];
  bits.push(`${entryCount} page${entryCount === 1 ? '' : 's'} written`);
  if (topMoodLabel) {
    bits.push(`${topMoodEmoji} Mostly ${topMoodLabel}`);
  }
  if (spendTotal > 0) {
    bits.push(`${formatFriendlyMoney(spendTotal, currency)} spent`);
  }
  bits.push(`${remindersCompleted} reminder${remindersCompleted === 1 ? '' : 's'} completed`);
  return bits.join(' / ');
}

/**
 * Purpose: You-tab fuller This week — journal / reminders / money as three friendly lines.
 * Inputs: computed weekly snapshot.
 * Outputs: three strings (empty-safe).
 * Side effects: none.
 */
export function weeklyLifeFullLines(input: {
  daysWritten: number;
  entryCount: number;
  wordCount: number;
  mostUsedTag: string | null;
  topMoodEmoji: string;
  topMoodLabel: string;
  remindersCompleted: number;
  remindersRemaining: number;
  remindersOverdue: number;
  spendTotal: number;
  currency: MoneyCurrency;
  topCategoryLabel: string;
  largestExpense: Expense | null;
}): { journalLine: string; remindersLine: string; moneyLine: string } {
  const journalBits: string[] = [
    `${input.daysWritten} day${input.daysWritten === 1 ? '' : 's'} written`,
    `${input.entryCount} page${input.entryCount === 1 ? '' : 's'}`,
  ];
  if (input.wordCount > 0) {
    journalBits.push(`${input.wordCount} words`);
  }
  if (input.mostUsedTag) {
    journalBits.push(`#${input.mostUsedTag}`);
  }
  if (input.topMoodLabel) {
    journalBits.push(`${input.topMoodEmoji} ${input.topMoodLabel}`);
  }
  const reminderBits = [
    `${input.remindersCompleted} completed`,
    `${input.remindersRemaining} remaining`,
  ];
  if (input.remindersOverdue > 0) {
    reminderBits.push(`${input.remindersOverdue} overdue`);
  }
  const moneyBits: string[] = [];
  if (input.spendTotal > 0) {
    moneyBits.push(formatFriendlyMoney(input.spendTotal, input.currency));
    if (input.topCategoryLabel) {
      moneyBits.push(input.topCategoryLabel);
    }
    if (input.largestExpense) {
      const note = input.largestExpense.note?.trim();
      const label = note || EXPENSE_CATEGORIES.find((row) => row.id === input.largestExpense?.category)?.label;
      moneyBits.push(
        `largest ${label ? `${label} ` : ''}${formatFriendlyMoney(input.largestExpense.amount, input.largestExpense.currency)}`,
      );
    }
  } else {
    moneyBits.push('nothing spent yet');
  }
  return {
    journalLine: journalBits.join(' · '),
    remindersLine: reminderBits.join(' · '),
    moneyLine: moneyBits.join(' · '),
  };
}

/**
 * Purpose: count enabled once-reminders (and overdue cards) whose due civil day is before today.
 * Inputs: reminders, credit cards, now.
 * Outputs: overdue count.
 * Side effects: none.
 */
export function countOverdueReminders(
  reminders: Reminder[],
  creditCards: CreditCardAccount[],
  now: Date = new Date(),
): number {
  let count = 0;
  const today = startOfLocalDay(now);
  for (const item of reminders) {
    if (!item.enabled || item.accountId) {
      continue;
    }
    if (item.recurrence.type !== 'once') {
      continue;
    }
    const fire = onceFireAt(item);
    if (fire && startOfLocalDay(fire) < today) {
      count += 1;
    }
  }
  for (const card of creditCards) {
    const nextDue = nextOrSameDayOfMonth(card.dueDayOfMonth, now);
    const lastDue = previousDayOfMonth(card.dueDayOfMonth, now);
    const daysToDue = civilDaysBetween(nextDue, now);
    const unpaid = card.amountDue !== undefined && Number.isFinite(card.amountDue) && card.amountDue > 0;
    const lastDuePassed = civilDaysBetween(now, lastDue) > 0 && daysToDue > 0;
    if (lastDuePassed && unpaid) {
      count += 1;
    }
  }
  return count;
}

/**
 * Purpose: This week snapshot from journal + spends + reminders (compact + fuller lines).
 * Inputs: entries, expenses, reminders, optional cards, home currency, now, weekStartsOn.
 * Outputs: counts plus Today/You copy. Spend totals use locked HKD (or same-currency amount).
 * Side effects: none.
 * Design decisions: weekStartsOn is the same AppSettings.weekStart as the Calendar month grid.
 */
export function computeWeeklyLifeSummary(
  entries: JournalEntry[],
  expenses: Expense[],
  reminders: Reminder[],
  currency: MoneyCurrency,
  now: Date = new Date(),
  creditCards: CreditCardAccount[] = [],
  weekStartsOn: WeekStart = 'monday',
): WeeklyLifeSummary {
  const soFar = thisWeekSoFar(now, weekStartsOn);
  const calendar = thisCalendarWeek(now, weekStartsOn);
  const rangeStart = new Date(calendar.start.getFullYear(), calendar.start.getMonth(), calendar.start.getDate(), 0, 0, 0, 0);
  const weekEnd = new Date(calendar.end.getFullYear(), calendar.end.getMonth(), calendar.end.getDate(), 23, 59, 59, 999);
  const weekEntries = entriesThisWeek(entries, now, weekStartsOn);
  const daysWritten = computeWritingDaysThisWeek(entries, now, weekStartsOn);
  const topMood = topMoodThisWeek(entries, now, weekStartsOn);
  const moodDef = topMood ? getMoodDefinition(topMood) : null;
  const spendTotal = spendInDayRange(expenses, currency, soFar.startKey, soFar.endKey);
  const weekSpends = expenses.filter((item) => {
    if (item.dayKey < soFar.startKey || item.dayKey > soFar.endKey) {
      return false;
    }
    return spendAmountIn(item, currency) !== undefined;
  });
  let topCategory: ExpenseCategory | null = null;
  let topCategoryAmount = 0;
  const categoryTotals = new Map<ExpenseCategory, number>();
  for (const item of weekSpends) {
    const home = spendAmountIn(item, currency);
    if (home === undefined) {
      continue;
    }
    const next = (categoryTotals.get(item.category) ?? 0) + home;
    categoryTotals.set(item.category, next);
    if (next > topCategoryAmount) {
      topCategory = item.category;
      topCategoryAmount = next;
    }
  }
  const largestExpense =
    [...weekSpends].sort((left, right) => {
      const leftHome = spendAmountIn(left, currency) ?? 0;
      const rightHome = spendAmountIn(right, currency) ?? 0;
      return rightHome - leftHome;
    })[0] ?? null;
  let remindersCompleted = 0;
  let remindersRemaining = 0;
  for (const item of reminders) {
    if (!item.enabled) {
      continue;
    }
    remindersCompleted += countReminderFiresInRange(item, rangeStart, now);
    const next = nextFireAt(item, now);
    if (next && next.getTime() <= weekEnd.getTime()) {
      remindersRemaining += 1;
    }
  }
  const remindersOverdue = countOverdueReminders(reminders, creditCards, now);
  const topMoodLabel = moodDef?.label ?? '';
  const topMoodEmoji = moodDef?.emoji ?? '';
  const topCategoryLabel = topCategory
    ? (EXPENSE_CATEGORIES.find((item) => item.id === topCategory)?.label ?? topCategory)
    : '';
  const wordCount = weekEntries.reduce((sum, entry) => sum + entry.wordCount, 0);
  const mostUsedTag = mostUsedTagOf(weekEntries);
  const compactCopy = weeklyLifeCompactCopy({
    entryCount: weekEntries.length,
    topMoodEmoji,
    topMoodLabel,
    spendTotal,
    currency,
    remindersCompleted,
  });
  const full = weeklyLifeFullLines({
    daysWritten,
    entryCount: weekEntries.length,
    wordCount,
    mostUsedTag,
    topMoodEmoji,
    topMoodLabel,
    remindersCompleted,
    remindersRemaining,
    remindersOverdue,
    spendTotal,
    currency,
    topCategoryLabel,
    largestExpense,
  });
  return {
    daysWritten,
    entryCount: weekEntries.length,
    wordCount,
    mostUsedTag,
    topMood,
    topMoodLabel,
    topMoodEmoji,
    spendTotal,
    topCategory,
    topCategoryLabel,
    largestExpense,
    currency,
    remindersCompleted,
    remindersRemaining,
    remindersOverdue,
    compactCopy,
    journalLine: full.journalLine,
    remindersLine: full.remindersLine,
    moneyLine: full.moneyLine,
    copy: compactCopy,
  };
}
