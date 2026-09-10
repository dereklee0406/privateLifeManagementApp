import type { Budget } from '../finance/Budget';
import type { Expense } from '../finance/Expense';
import { budgetProgressFor } from '../finance/financeStats';
import { computeMonthSpendInsight } from '../finance/monthInsights';
import {
  monthKeyFromDate,
  snapshotDeltaVsPrevious,
  sortHistoryNewestFirst,
  type NetWorthHistoryRow,
} from '../finance/netWorthHistory';
import {
  computeWritingDaysInMonth,
  entriesInMonth,
} from '../journal/journalStats';
import type { JournalEntry } from '../journal/JournalEntry';
import type { Reminder } from '../reminders/Reminder';
import { habitHitRateBetween } from '../reminders/habitStreaks';
import type { MoneyCurrency } from '../settings/AppSettings';
import { toDayKey } from '../../utils/dateUtils';
import { pickMonthlyPressure, type InsightsPressure } from './pressure';

/**
 * Purpose: Insights This month board pack — pages, habits, spend vs last month, net-worth delta.
 * Inputs: computeMonthlyInsightsReport.
 * Outputs: facts + one pressure kind. View writes the sentences.
 * Side effects: none.
 */
export interface MonthlyInsightsReport {
  pageCount: number;
  writingDays: number;
  wordCount: number;
  habitHitRate: number | null;
  activeHabitCount: number;
  spent: number;
  previousSpent: number;
  spendPercentChange: number | null;
  hasPreviousSpend: boolean;
  currency: MoneyCurrency;
  budgetOverCount: number;
  budgetCount: number;
  netWorthDelta: number | undefined;
  hasNetWorthSnapshot: boolean;
  pressure: InsightsPressure;
}

/**
 * Purpose: month scoreboard from journal stats, habit window, spend insight, snapshot history.
 * Inputs: entries, expenses, reminders, budgets, net-worth history, home currency, now.
 * Outputs: MonthlyInsightsReport (pure; snapshots are read-only).
 * Side effects: none.
 * Design decisions: spend comparison reuses computeMonthSpendInsight. Net-worth delta is
 *   current-month snapshot vs previous month in the same currency — not a live vs ghost number.
 *   Habit hit is month-to-date, not Season’s trailing 30 days. Rule-based pressure only.
 */
export function computeMonthlyInsightsReport(
  entries: JournalEntry[],
  expenses: Expense[],
  reminders: Reminder[],
  budgets: Budget[],
  history: NetWorthHistoryRow[],
  currency: MoneyCurrency,
  now: Date = new Date(),
): MonthlyInsightsReport {
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthEntries = entriesInMonth(entries, year, month).filter(
    (entry) => new Date(entry.createdAt).getTime() <= now.getTime(),
  );
  const writingDays = computeWritingDaysInMonth(entries, year, month, now);
  const wordCount = monthEntries.reduce((sum, entry) => sum + entry.wordCount, 0);
  const monthStartKey = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const habits = habitHitRateBetween(reminders, monthStartKey, toDayKey(now));
  const spend = computeMonthSpendInsight(expenses, currency, now);
  const budgetRows = budgetProgressFor(budgets, expenses, year, month, currency);
  const budgetOverCount = budgetRows.filter((row) => row.over).length;
  const monthKey = monthKeyFromDate(now);
  const sorted = sortHistoryNewestFirst(history);
  const currentIndex = sorted.findIndex((row) => row.monthKey === monthKey && row.currency === currency);
  const hasNetWorthSnapshot = currentIndex >= 0;
  const netWorthDelta = hasNetWorthSnapshot ? snapshotDeltaVsPrevious(sorted, currentIndex) : undefined;
  const pressure = pickMonthlyPressure({
    dayOfMonth: now.getDate(),
    writingDays,
    pageCount: monthEntries.length,
    spent: spend.spent,
    spendPercentChange: spend.percentChange,
    habitHitRate: habits.rate,
    budgetOverCount,
    netWorthDelta,
  });
  return {
    pageCount: monthEntries.length,
    writingDays,
    wordCount,
    habitHitRate: habits.rate,
    activeHabitCount: habits.activeHabitCount,
    spent: spend.spent,
    previousSpent: spend.previousSpent,
    spendPercentChange: spend.percentChange,
    hasPreviousSpend: spend.hasPrevious,
    currency,
    budgetOverCount,
    budgetCount: budgetRows.length,
    netWorthDelta,
    hasNetWorthSnapshot,
    pressure,
  };
}
