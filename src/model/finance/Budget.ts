import type { ExpenseCategory } from './Expense';
import type { MoneyCurrency } from '../settings/AppSettings';

/**
 * Purpose: monthly envelope for one spend category (limit only; spent is derived).
 * Inputs: Money tab budget form.
 * Outputs: JSON row keyed by year + month + category + currency.
 * Side effects: none.
 * Design decisions: not a ledger — one envelope per category per month. Overspend is a hint, not a posting.
 */
export interface Budget {
  id: string;
  year: number;
  month: number;
  category: ExpenseCategory;
  limit: number;
  currency: MoneyCurrency;
}

export interface BudgetDraft {
  year: number;
  month: number;
  category: ExpenseCategory;
  limit: number;
  currency: MoneyCurrency;
}

/**
 * Purpose: envelope vs live spend for the Money / Aura snapshot.
 */
export interface BudgetProgress {
  budget: Budget;
  spent: number;
  remaining: number;
  over: boolean;
}

/**
 * Purpose: reflection copy when an envelope is exceeded (journal prompt, not accounting).
 * Inputs: category label, spent, limit, currency.
 * Outputs: a short page starter.
 * Side effects: none.
 */
export function budgetReflectionPrompt(
  categoryLabel: string,
  spent: number,
  limit: number,
  currency: MoneyCurrency,
): string {
  return `This month’s ${categoryLabel} budget is over (${currency} ${spent.toFixed(2)} of ${currency} ${limit.toFixed(2)}). What happened, and what would I like next month to feel like?`;
}
