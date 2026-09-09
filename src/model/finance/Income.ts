import type { MoneyCurrency } from '../settings/AppSettings';

/**
 * Purpose: kinds for manual income (no payroll feed).
 * Inputs: income form.
 * Outputs: stored on IncomeEntry.kind.
 * Side effects: none.
 */
export type IncomeKind = 'salary' | 'bonus' | 'other';

export const INCOME_KINDS: Array<{ id: IncomeKind; label: string }> = [
  { id: 'salary', label: 'Salary' },
  { id: 'bonus', label: 'Bonus' },
  { id: 'other', label: 'Other' },
];

/**
 * Purpose: one on-device income row (salary, bonus, other).
 * Inputs: FinanceController create.
 * Outputs: JSON-serializable income.
 * Side effects: none.
 * Design decisions: dated like expenses so leftover is a sum, not a typed monthly blob. Optional journal/reminder ids stay for old rows.
 */
export interface IncomeEntry {
  id: string;
  kind: IncomeKind;
  amount: number;
  currency: MoneyCurrency;
  dayKey: string;
  note?: string;
  journalEntryId?: string;
  reminderId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IncomeDraft {
  kind: IncomeKind;
  amount: number;
  currency: MoneyCurrency;
  dayKey: string;
  note?: string;
  journalEntryId?: string;
  reminderId?: string;
}
