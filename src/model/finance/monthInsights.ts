import { EXPENSE_CATEGORIES, formatFriendlyMoney, type Expense, type ExpenseCategory } from './Expense';
import type { MoneyCurrency } from '../settings/AppSettings';
import { monthPrefix, monthSpendTotal } from './financeStats';
import { spendAmountIn } from './fx';

export interface MonthSpendInsight {
  spent: number;
  previousSpent: number;
  hasPrevious: boolean;
  percentChange: number | null;
  changeLine: string | null;
  topCategory: ExpenseCategory | null;
  topCategoryLabel: string;
  topCategoryAmount: number;
  topCategoryLine: string | null;
}

/**
 * Purpose: lite Money insight under Spent this month — total, vs last month, top category. No forecast.
 * Inputs: expenses, home currency, now.
 * Outputs: comparison when last month has convertible spend.
 * Side effects: none.
 * Design decisions: totals use locked `homeAmount` (or same-currency amount), not live FX.
 */
export function computeMonthSpendInsight(
  expenses: Expense[],
  currency: MoneyCurrency,
  now: Date = new Date(),
): MonthSpendInsight {
  const year = now.getFullYear();
  const month = now.getMonth();
  const spent = monthSpendTotal(expenses, year, month, currency);
  const prev = previousYearMonth(year, month);
  const previousSpent = monthSpendTotal(expenses, prev.year, prev.month, currency);
  const hasPrevious = expenses.some((item) => {
    if (!item.dayKey.startsWith(monthPrefix(prev.year, prev.month))) {
      return false;
    }
    return spendAmountIn(item, currency) !== undefined;
  });
  const canCompare = hasPrevious && previousSpent > 0;
  const percentChange = canCompare ? Math.round(((spent - previousSpent) / previousSpent) * 100) : null;
  let changeLine: string | null = null;
  if (percentChange !== null) {
    if (percentChange > 0) {
      changeLine = `↑ ${percentChange}% vs last month`;
    } else if (percentChange < 0) {
      changeLine = `↓ ${Math.abs(percentChange)}% vs last month`;
    } else {
      changeLine = 'Same as last month';
    }
  }

  const prefix = monthPrefix(year, month);
  const seen = new Set<ExpenseCategory>();
  for (const item of expenses) {
    if (item.dayKey.startsWith(prefix)) {
      seen.add(item.category);
    }
  }
  let topCategory: ExpenseCategory | null = null;
  let topCategoryAmount = 0;
  for (const id of seen) {
    const amount = monthSpendTotal(expenses, year, month, currency, id);
    if (amount > topCategoryAmount) {
      topCategory = id;
      topCategoryAmount = amount;
    }
  }
  const topCategoryLabel = topCategory
    ? (EXPENSE_CATEGORIES.find((item) => item.id === topCategory)?.label ?? topCategory)
    : '';
  const topCategoryLine =
    topCategory && topCategoryAmount > 0
      ? `${topCategoryLabel} · ${formatFriendlyMoney(topCategoryAmount, currency)}`
      : null;

  return {
    spent,
    previousSpent,
    hasPrevious: canCompare,
    percentChange,
    changeLine,
    topCategory,
    topCategoryLabel,
    topCategoryAmount,
    topCategoryLine,
  };
}

function previousYearMonth(year: number, month: number): { year: number; month: number } {
  if (month === 0) {
    return { year: year - 1, month: 11 };
  }
  return { year, month: month - 1 };
}
