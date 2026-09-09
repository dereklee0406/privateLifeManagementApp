import type { Asset } from './Asset';
import type { Budget } from './Budget';
import type { Expense } from './Expense';
import type { ExpenseSplit } from './ExpenseSplit';
import type { IncomeEntry } from './Income';
import type { Loan } from './Loan';
import type { RecurringSpend } from './recurringSpend';
import type { TransferEntry } from './Transfer';
import type { MoneyCurrency } from '../settings/AppSettings';

/**
 * Purpose: leftover = month income − month spend for one currency.
 * Inputs: income and expense sums.
 * Outputs: snapshot for Today / Money (not a stored total).
 * Side effects: none.
 */
export interface MonthMoneySnapshot {
  year: number;
  month: number;
  currency: MoneyCurrency;
  income: number;
  spent: number;
  leftover: number;
}

/**
 * Purpose: compute leftover without storing derived totals.
 */
export function buildMonthSnapshot(
  year: number,
  month: number,
  currency: MoneyCurrency,
  income: number,
  spent: number,
): MonthMoneySnapshot {
  const safeIncome = Number.isFinite(income) ? income : 0;
  const safeSpent = Number.isFinite(spent) ? spent : 0;
  return {
    year,
    month,
    currency,
    income: safeIncome,
    spent: safeSpent,
    leftover: safeIncome - safeSpent,
  };
}

/**
 * Purpose: on-device personal finance document (not a double-entry ledger).
 * Inputs: FinanceController save/load.
 * Outputs: JSON persisted by FinanceLocalStore.
 * Side effects: none.
 */
export interface FinanceDocument {
  expenses: Expense[];
  incomes: IncomeEntry[];
  budgets: Budget[];
  assets: Asset[];
  loans: Loan[];
  /** Optional weekday coffee-style repeats. Missing on older documents. */
  recurringSpends?: RecurringSpend[];
  /** Inter-account transfers and card repayments. */
  transfers?: TransferEntry[];
  /** Optional split-expense settlements among friends/family. Missing on older documents. */
  splits?: ExpenseSplit[];
}

/**
 * Purpose: empty finance document for first launch / corrupt JSON.
 */
export function emptyFinanceDocument(): FinanceDocument {
  return {
    expenses: [],
    incomes: [],
    budgets: [],
    assets: [],
    loans: [],
    recurringSpends: [],
    transfers: [],
    splits: [],
  };
}
