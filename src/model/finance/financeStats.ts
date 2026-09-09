import type { Expense, ExpenseCategory } from './Expense';
import type { IncomeEntry } from './Income';
import type { Budget, BudgetProgress } from './Budget';
import { buildMonthSnapshot, type MonthMoneySnapshot } from './Account';
import type { MoneyCurrency } from '../settings/AppSettings';
import { spendAmountIn } from './fx';

/**
 * Purpose: YYYY-MM prefix for a calendar month.
 */
export function monthPrefix(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/**
 * Purpose: sum expenses in a calendar month in home currency (optionally one category).
 * Inputs: expenses, year/month, home currency, optional category.
 * Outputs: total in `currency`. Foreign rows use locked HKD (`homeAmount`); missing snapshots are skipped.
 * Side effects: none.
 * Design decisions: never live-convert saved rows. HKD totals are the fee-inclusive amount locked at save.
 */
export function monthSpendTotal(
  expenses: Expense[],
  year: number,
  month: number,
  currency: MoneyCurrency,
  category?: ExpenseCategory,
): number {
  const prefix = monthPrefix(year, month);
  return expenses
    .filter((item) => item.dayKey.startsWith(prefix) && (category === undefined || item.category === category))
    .reduce((sum, item) => sum + (spendAmountIn(item, currency) ?? 0), 0);
}

/**
 * Purpose: sum income entries in a calendar month for one currency.
 */
export function monthIncomeTotal(
  incomes: IncomeEntry[],
  year: number,
  month: number,
  currency: MoneyCurrency,
): number {
  const prefix = monthPrefix(year, month);
  return incomes
    .filter((item) => item.currency === currency && item.dayKey.startsWith(prefix))
    .reduce((sum, item) => sum + item.amount, 0);
}

/**
 * Purpose: expenses on one civil day.
 */
export function expensesOnDay(expenses: Expense[], dayKey: string): Expense[] {
  return expenses
    .filter((item) => item.dayKey === dayKey)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export type ExpenseDatePreset = 'month' | '7d' | '30d' | 'all';

/**
 * Purpose: filter expenses by category and inclusive date range.
 * Inputs: list, optional category, from/to day keys (YYYY-MM-DD).
 * Outputs: matching rows, newest day first.
 * Side effects: none.
 */
export function filterExpenses(
  expenses: Expense[],
  input: { category?: ExpenseCategory | 'all'; fromDay?: string | null; toDay?: string | null },
): Expense[] {
  return expenses
    .filter((item) => {
      if (input.category && input.category !== 'all' && item.category !== input.category) {
        return false;
      }
      if (input.fromDay && item.dayKey < input.fromDay) {
        return false;
      }
      if (input.toDay && item.dayKey > input.toDay) {
        return false;
      }
      return true;
    })
    .sort((left, right) => right.dayKey.localeCompare(left.dayKey) || right.createdAt.localeCompare(left.createdAt));
}

/**
 * Purpose: map a list preset onto from/to day keys.
 */
function localDayKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function expenseRangeFromPreset(
  preset: ExpenseDatePreset,
  year: number,
  month: number,
  now: Date = new Date(),
): { fromDay: string | null; toDay: string | null } {
  const today = localDayKey(now);
  if (preset === 'all') {
    return { fromDay: null, toDay: null };
  }
  if (preset === 'month') {
    return { fromDay: `${monthPrefix(year, month)}-01`, toDay: today };
  }
  const daysBack = preset === '7d' ? 6 : 29;
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBack);
  return { fromDay: localDayKey(from), toDay: today };
}

/**
 * Purpose: last N calendar months of spend for a tiny bar chart (View only).
 */
export function spendTrend(
  expenses: Expense[],
  currency: MoneyCurrency,
  months: number,
  now: Date = new Date(),
): Array<{ key: string; label: string; amount: number }> {
  const rows: Array<{ key: string; label: string; amount: number }> = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const amount = monthSpendTotal(expenses, date.getFullYear(), date.getMonth(), currency);
    rows.push({
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date),
      amount,
    });
  }
  return rows;
}

/**
 * Purpose: month snapshot from income entries + live expense sum.
 */
export function monthSnapshotFor(
  incomes: IncomeEntry[],
  expenses: Expense[],
  year: number,
  month: number,
  currency: MoneyCurrency,
): MonthMoneySnapshot {
  return buildMonthSnapshot(
    year,
    month,
    currency,
    monthIncomeTotal(incomes, year, month, currency),
    monthSpendTotal(expenses, year, month, currency),
  );
}

/**
 * Purpose: envelope progress for a month (spent derived from expenses).
 */
export function budgetProgressFor(
  budgets: Budget[],
  expenses: Expense[],
  year: number,
  month: number,
  currency: MoneyCurrency,
): BudgetProgress[] {
  return budgets
    .filter((item) => item.year === year && item.month === month && item.currency === currency)
    .map((budget) => {
      const spent = monthSpendTotal(expenses, year, month, currency, budget.category);
      return {
        budget,
        spent,
        remaining: budget.limit - spent,
        over: spent > budget.limit,
      };
    });
}

/**
 * Purpose: envelopes that a new spend would (or did) exceed.
 */
export function overspentBudgets(
  budgets: Budget[],
  expenses: Expense[],
  year: number,
  month: number,
  currency: MoneyCurrency,
  category?: ExpenseCategory,
): BudgetProgress[] {
  return budgetProgressFor(budgets, expenses, year, month, currency).filter(
    (row) => row.over && (category === undefined || row.budget.category === category),
  );
}
