import type { Expense } from '../finance/Expense';
import type { Budget } from '../finance/Budget';
import { budgetProgressFor } from '../finance/financeStats';
import type { JournalEntry } from '../journal/JournalEntry';
import { computeWeeklyLifeSummary } from '../life/weeklySummary';
import type { Reminder } from '../reminders/Reminder';
import type { CreditCardAccount } from '../reminders/creditCards';
import { habitHitRateBetween } from '../reminders/habitStreaks';
import type { MoneyCurrency, WeekStart } from '../settings/AppSettings';
import { thisWeekSoFar } from '../life/weekBounds';
import { pickWeeklyPressure, type InsightsPressure } from './pressure';

/**
 * Purpose: Insights This week synthesis facts — not a reprint of Rhythm / Wallet lists.
 * Inputs: computeWeeklyInsightsReport.
 * Outputs: counts + one pressure kind; View localizes and deep-links.
 * Side effects: none.
 */
export interface WeeklyInsightsReport {
  daysWritten: number;
  pageCount: number;
  wordCount: number;
  spendTotal: number;
  currency: MoneyCurrency;
  remindersCompleted: number;
  remindersRemaining: number;
  remindersOverdue: number;
  habitHitRate: number | null;
  activeHabitCount: number;
  budgetOverCount: number;
  pressure: InsightsPressure;
}

/**
 * Purpose: week scoreboard from existing weeklySummary + habit window + envelope overspend.
 * Inputs: journal, expenses, reminders, optional cards, home currency, now, week start.
 * Outputs: WeeklyInsightsReport (pure).
 * Side effects: none.
 * Design decisions: reuses computeWeeklyLifeSummary so Today chips and Insights week share counts.
 *   Habit hit is this week so far, not the 30-day Season pillar. No cloud copy.
 */
export function computeWeeklyInsightsReport(
  entries: JournalEntry[],
  expenses: Expense[],
  reminders: Reminder[],
  budgets: Budget[],
  currency: MoneyCurrency,
  now: Date = new Date(),
  creditCards: CreditCardAccount[] = [],
  weekStartsOn: WeekStart = 'monday',
): WeeklyInsightsReport {
  const week = computeWeeklyLifeSummary(
    entries,
    expenses,
    reminders,
    currency,
    now,
    creditCards,
    weekStartsOn,
  );
  const range = thisWeekSoFar(now, weekStartsOn);
  const habits = habitHitRateBetween(reminders, range.startKey, range.endKey);
  const budgetRows = budgetProgressFor(budgets, expenses, now.getFullYear(), now.getMonth(), currency);
  const budgetOverCount = budgetRows.filter((row) => row.over).length;
  const pressure = pickWeeklyPressure({
    daysWritten: week.daysWritten,
    pageCount: week.entryCount,
    spendTotal: week.spendTotal,
    remindersCompleted: week.remindersCompleted,
    remindersOverdue: week.remindersOverdue,
    habitHitRate: habits.rate,
    budgetOverCount,
  });
  return {
    daysWritten: week.daysWritten,
    pageCount: week.entryCount,
    wordCount: week.wordCount,
    spendTotal: week.spendTotal,
    currency,
    remindersCompleted: week.remindersCompleted,
    remindersRemaining: week.remindersRemaining,
    remindersOverdue: week.remindersOverdue,
    habitHitRate: habits.rate,
    activeHabitCount: habits.activeHabitCount,
    budgetOverCount,
    pressure,
  };
}
