import type { Expense, ExpenseCategory, ExpenseDraft } from './Expense';
import type { MoneyCurrency } from '../settings/AppSettings';
import { formatFriendlyMoney } from './Expense';
import { buildExpenseFxSnapshot, type FxRateTable } from './fx';
import { toDayKey } from '../../utils/dateUtils';

/**
 * Purpose: how often a recurring spend is due.
 * Inputs: spend form frequency picker; legacy rows omit this and use `weekdays` only.
 * Outputs: stored on RecurringSpend; drives due-today checks.
 */
export type RecurringSpendFrequency = 'daily' | 'weekday' | 'weekly' | 'monthly';

/**
 * Purpose: a repeat rule for the same coffee / transit / lunch — not a ledger schedule engine.
 * Inputs: spend form “Repeat”; Money due chip; Today 1-tap strip.
 * Outputs: JSON row on the finance document.
 * Side effects: none.
 * Design decisions: legacy rows only have `weekdays: number[]` (Mon–Fri coffee). New optional
 *   `frequency` / `dayOfWeek` / `dayOfMonth` / `cardId` expand the loop without breaking old JSON.
 *   She still taps (or 1-taps) to log today’s copy — rules never auto-post ledger rows.
 */
export interface RecurringSpend {
  id: string;
  amount: number;
  currency: MoneyCurrency;
  category: ExpenseCategory;
  note?: string;
  /** JS getDay() values; weekday coffee is 1–5. Kept for legacy + weekday frequency. */
  weekdays: number[];
  /** When omitted, due-today uses `weekdays` (legacy weekday-repeat behavior). */
  frequency?: RecurringSpendFrequency;
  /** For `weekly`; 0 = Sunday … 6 = Saturday. Falls back to `weekdays[0]` when missing. */
  dayOfWeek?: number;
  /** For `monthly`; 1–31, month start, or last civil day. */
  dayOfMonth?: number | 'start' | 'end';
  /** Optional default payment card for 1-tap log. */
  cardId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringSpendDraft {
  amount: number;
  currency: MoneyCurrency;
  category: ExpenseCategory;
  note?: string;
  weekdays?: number[];
  frequency?: RecurringSpendFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number | 'start' | 'end';
  cardId?: string;
}

export const WEEKDAY_REPEAT: number[] = [1, 2, 3, 4, 5];

/**
 * Purpose: resolve effective frequency with legacy fallback.
 * Inputs: rule (may omit frequency).
 * Outputs: frequency used by due-today and labels.
 * Side effects: none.
 * Design decisions: missing frequency → treat as weekday using `weekdays` (old Mon–Fri rows).
 */
export function resolveRecurringSpendFrequency(rule: RecurringSpend): RecurringSpendFrequency {
  return rule.frequency ?? 'weekday';
}

/**
 * Purpose: last civil day of a local month (monthIndex 0–11).
 * Inputs: year and month index.
 * Outputs: 28–31.
 * Side effects: none.
 */
function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Purpose: whether this rule should offer a log today.
 * Inputs: rule, local now.
 * Outputs: true when today’s civil day matches the frequency.
 * Side effects: none.
 * Design decisions: daily always; weekday Mon–Fri (or custom `weekdays`); weekly matches dayOfWeek;
 *   monthly matches dayOfMonth / start / end. Legacy rows without frequency use `weekdays.includes`.
 */
export function recurringSpendIsDueToday(rule: RecurringSpend, now: Date = new Date()): boolean {
  const frequency = resolveRecurringSpendFrequency(rule);
  switch (frequency) {
    case 'daily':
      return true;
    case 'weekday': {
      const days = rule.weekdays.length ? rule.weekdays : WEEKDAY_REPEAT;
      return days.includes(now.getDay());
    }
    case 'weekly': {
      const day =
        typeof rule.dayOfWeek === 'number' && rule.dayOfWeek >= 0 && rule.dayOfWeek <= 6
          ? rule.dayOfWeek
          : rule.weekdays[0];
      return typeof day === 'number' && now.getDay() === day;
    }
    case 'monthly': {
      const anchor = rule.dayOfMonth ?? now.getDate();
      if (anchor === 'start') {
        return now.getDate() === 1;
      }
      if (anchor === 'end') {
        return now.getDate() === lastDayOfMonth(now.getFullYear(), now.getMonth());
      }
      const day = Math.min(31, Math.max(1, Math.floor(anchor)));
      const clamped = Math.min(day, lastDayOfMonth(now.getFullYear(), now.getMonth()));
      return now.getDate() === clamped;
    }
    default:
      return rule.weekdays.includes(now.getDay());
  }
}

/**
 * Purpose: already logged today’s copy of this rule.
 * Inputs: rule, spend list, now.
 * Outputs: true when an expense with this recurringSpendId exists on today’s dayKey.
 * Side effects: none.
 */
export function recurringSpendLoggedToday(
  rule: RecurringSpend,
  expenses: Expense[],
  now: Date = new Date(),
): boolean {
  const today = toDayKey(now);
  return expenses.some((item) => item.recurringSpendId === rule.id && item.dayKey === today);
}

/**
 * Purpose: rules that still need today’s tap.
 * Inputs: rules, spends, now.
 * Outputs: due rules (frequency matches today and not yet logged).
 * Side effects: none.
 */
export function dueRecurringSpends(
  rules: RecurringSpend[],
  expenses: Expense[],
  now: Date = new Date(),
): RecurringSpend[] {
  return rules.filter(
    (rule) => recurringSpendIsDueToday(rule, now) && !recurringSpendLoggedToday(rule, expenses, now),
  );
}

/**
 * Purpose: build a complete ExpenseDraft from a recurring rule for 1-tap log.
 * Inputs: rule, local now, optional FX table + card fee for foreign locks.
 * Outputs: ExpenseDraft with dayKey, recurringSpendId, cardId, and locked FX when foreign.
 * Side effects: none.
 * Design decisions: snapshot is locked at `now`; HKD omits fx; never sets weekdayRepeat (rule already exists).
 */
export function buildExpenseDraftFromRecurring(
  rule: RecurringSpend,
  now: Date = new Date(),
  fxTable?: FxRateTable | null,
  cardFeeRate: number = 0,
): ExpenseDraft {
  const snapshot = buildExpenseFxSnapshot(rule.amount, rule.currency, fxTable, cardFeeRate, now);
  return {
    amount: Math.max(0, rule.amount),
    currency: rule.currency,
    category: rule.category,
    dayKey: toDayKey(now),
    note: rule.note,
    cardId: rule.cardId,
    recurringSpendId: rule.id,
    fx: snapshot ?? (rule.currency === 'HKD' ? null : undefined),
  };
}

/**
 * Purpose: short frequency label for UI (rules list, chips).
 * Inputs: rule.
 * Outputs: e.g. “Daily”, “Weekdays”, “Weekly”, “Monthly”.
 * Side effects: none.
 */
export function recurringSpendFrequencyLabel(rule: RecurringSpend): string {
  switch (resolveRecurringSpendFrequency(rule)) {
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    case 'weekday':
    default:
      return 'Weekdays';
  }
}

/**
 * Purpose: chip label for “same coffee every weekday”.
 * Inputs: rule.
 * Outputs: e.g. “Today’s coffee · HK$35”.
 * Side effects: none.
 */
export function recurringSpendChipLabel(rule: RecurringSpend): string {
  const note = rule.note?.trim();
  const money = formatFriendlyMoney(rule.amount, rule.currency);
  return note ? `Today’s ${note} · ${money}` : `Same as usual · ${money}`;
}
