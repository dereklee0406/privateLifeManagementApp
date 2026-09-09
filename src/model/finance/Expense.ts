import type { MoneyCurrency } from '../settings/AppSettings';

export type { ExpenseCategory, ExpenseCategoryConfig } from './expenseCategories';
export {
  EXPENSE_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORIES,
  activeExpenseCategories,
  resolveExpenseCategories,
  expenseCategoryFallbackLabel,
  quickAddCategoryIds,
  iconNameForExpenseCategory,
  addCustomExpenseCategory,
  removeExpenseCategory,
  moveExpenseCategory,
  resetExpenseCategories,
  EXPENSE_CATEGORY_ICON_CHOICES,
  type ExpenseCategoryIconName,
} from './expenseCategories';

import type { ExpenseCategory } from './expenseCategories';
/**
 * Purpose: locked HKD conversion for one foreign spend (what it cost at save).
 * Inputs: convert at save from the live Frankfurter table + card fee.
 * Outputs: JSON fields stored on Expense; never recomputed after save.
 * Side effects: none.
 * Design decisions: quote is always HKD (dual-line estimate). Same-currency HKD spends omit this.
 */
export interface ExpenseFxSnapshot {
  homeAmount: number;
  quoteCurrency: 'HKD';
  fxRate: number;
  cardFeeRate: number;
  convertedAt: string;
}

/**
 * Purpose: one on-device spend row (no bank feed).
 * Inputs: FinanceController create/update.
 * Outputs: JSON-serializable expense.
 * Side effects: none.
 * Design decisions: optional journalEntryId / reminderId stay for old rows; the default UI does not create those joins. Receipt photos are URIs like journal.
 *   Foreign spends persist a per-row HKD snapshot (`homeAmount` … `convertedAt`); lists and totals use that, not live FX.
 *   Optional `cardId` links a spend to a CreditCardAccount for “paid with” tracking — not double-entry or bank sync.
 */
export interface Expense {
  id: string;
  amount: number;
  currency: MoneyCurrency;
  category: ExpenseCategory;
  dayKey: string;
  note?: string;
  photoUris: string[];
  journalEntryId?: string;
  reminderId?: string;
  accountId?: string;
  /** Optional credit card this spend was charged to (CreditCardAccount.id). */
  cardId?: string;
  /** When set, this row is today’s copy of a weekday repeat (same coffee). */
  recurringSpendId?: string;
  createdAt: string;
  updatedAt: string;
  /** Fee-inclusive estimated HKD at save. Absent on HKD spends and on legacy rows until backfill. */
  homeAmount?: number;
  quoteCurrency?: 'HKD';
  /** Mid-market HKD per 1 unit of `currency` at `convertedAt` (before card fee). */
  fxRate?: number;
  cardFeeRate?: number;
  convertedAt?: string;
}

export interface ExpenseDraft {
  amount: number;
  currency: MoneyCurrency;
  category: ExpenseCategory;
  dayKey: string;
  note?: string;
  photoUris?: string[];
  journalEntryId?: string;
  reminderId?: string;
  accountId?: string;
  /** Optional credit card this spend was charged to (CreditCardAccount.id). */
  cardId?: string;
  recurringSpendId?: string;
  /** Create or refresh a recurring rule from this spend. */
  weekdayRepeat?: boolean;
  /** Cadence when weekdayRepeat is on (default weekday / Mon–Fri). */
  frequency?: 'daily' | 'weekday' | 'weekly' | 'monthly';
  dayOfWeek?: number;
  dayOfMonth?: number | 'start' | 'end';
  /** Locked conversion for this save. `null` clears (HKD). Omit to leave existing snapshot when amount/currency unchanged. */
  fx?: ExpenseFxSnapshot | null;
}

/**
 * Purpose: map a reminder top/sub path onto an expense category for “log this payment”.
 * Inputs: reminder category path ids.
 * Outputs: ExpenseCategory.
 * Side effects: none.
 */
export function expenseCategoryFromReminder(top?: string, subcategory?: string): ExpenseCategory {
  if (top === 'health') {
    return 'health';
  }
  if (top === 'financial' || subcategory === 'credit-card' || subcategory === 'bills' || subcategory === 'loan') {
    return 'bills';
  }
  return 'other';
}

/**
 * Purpose: HKD-first money label.
 * Inputs: amount and currency.
 * Outputs: e.g. HKD 128.50
 * Side effects: none.
 */
export function formatMoney(amount: number, currency: MoneyCurrency): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${currency} ${safe.toFixed(2)}`;
}

/**
 * Purpose: girlfriend-facing money on Today / recent chips (HK$1,250).
 * Inputs: amount and reporting currency.
 * Outputs: compact symbol + grouped number; whole dollars drop cents.
 * Side effects: none.
 * Design decisions: symbols stay local (HK$ / US$ / CN¥) so Today copy is not “HKD 1250.00”.
 */
export function formatFriendlyMoney(amount: number, currency: MoneyCurrency): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const prefix = currency === 'HKD' ? 'HK$' : currency === 'USD' ? 'US$' : 'CN¥';
  const whole = Math.abs(safe - Math.round(safe)) < 0.005;
  const body = whole
    ? Math.round(safe).toLocaleString('en-US')
    : safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${prefix}${body}`;
}
