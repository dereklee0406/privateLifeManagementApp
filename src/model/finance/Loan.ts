import type { MoneyCurrency } from '../settings/AppSettings';

/**
 * Purpose: lightweight loan kinds aligned with reminder Financial → Loan types.
 */
export type LoanKind = 'mortgage' | 'personal' | 'car';

export const LOAN_KINDS: Array<{ id: LoanKind; label: string }> = [
  { id: 'mortgage', label: 'Mortgage' },
  { id: 'personal', label: 'Personal' },
  { id: 'car', label: 'Car' },
];

/**
 * Purpose: outstanding loan balance, optionally joined to a reminder.
 * Inputs: Money tab loan form.
 * Outputs: JSON row subtracted in net worth.
 * Side effects: none.
 * Design decisions: not an amortization table. reminderId is the OS join to mortgage/personal/car pings.
 */
export interface Loan {
  id: string;
  kind: LoanKind;
  name: string;
  balance: number;
  currency: MoneyCurrency;
  reminderId?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoanDraft {
  kind: LoanKind;
  name: string;
  balance: number;
  currency: MoneyCurrency;
  reminderId?: string;
  note?: string;
}

/**
 * Purpose: map a reminder loan type id onto LoanKind.
 * Inputs: categoryPath.type from Financial → Loan.
 * Outputs: LoanKind (personal when unknown).
 * Side effects: none.
 */
export function loanKindFromReminderType(type?: string): LoanKind {
  if (type === 'mortgage') {
    return 'mortgage';
  }
  if (type === 'car-loan') {
    return 'car';
  }
  return 'personal';
}
