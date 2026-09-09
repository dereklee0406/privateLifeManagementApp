import { clampDayOfMonth } from '../reminders/nextFire';
import type { CreditCardAccount } from '../reminders/creditCards';
import { startOfLocalDay } from '../journal/journalStats';
import { formatMoney } from './Expense';
import type { MoneyCurrency } from '../settings/AppSettings';

export type CardHealthStatus = 'ok' | 'soon' | 'overdue';

export interface CardHealthRow {
  id: string;
  name: string;
  daysToDue: number;
  dueDate: Date;
  statementDate: Date;
  amountDue?: number;
  status: CardHealthStatus;
  statusLabel: string;
  dueLine: string;
  cycleLine: string;
}

/**
 * Purpose: next civil occurrence of a day-of-month, including today.
 * Inputs: 1–31 day and now.
 * Outputs: local noon on that day this month, or next month if it already passed.
 * Side effects: none.
 */
export function nextOrSameDayOfMonth(dayOfMonth: number, now: Date = new Date()): Date {
  const build = (year: number, monthIndex: number): Date => {
    const day = clampDayOfMonth(year, monthIndex + 1, dayOfMonth);
    return new Date(year, monthIndex, day, 12, 0, 0, 0);
  };
  const today = startOfLocalDay(now);
  const thisMonth = build(now.getFullYear(), now.getMonth());
  if (thisMonth.getTime() >= today) {
    return thisMonth;
  }
  const nextIndex = now.getMonth() + 1;
  return build(now.getFullYear() + Math.floor(nextIndex / 12), nextIndex % 12);
}

/**
 * Purpose: previous civil occurrence of a day-of-month (yesterday-or-earlier).
 * Inputs: 1–31 day and now.
 * Outputs: local noon on the last time that day landed before today. Today’s due is not “previous.”
 * Side effects: none.
 */
export function previousDayOfMonth(dayOfMonth: number, now: Date = new Date()): Date {
  const next = nextOrSameDayOfMonth(dayOfMonth, now);
  const prevIndex = next.getMonth() - 1;
  const year = next.getFullYear() + (prevIndex < 0 ? -1 : 0);
  const monthIndex = (prevIndex + 12) % 12;
  const day = clampDayOfMonth(year, monthIndex + 1, dayOfMonth);
  return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

/**
 * Purpose: whole days from start of `from` to start of `to` (can be negative).
 * Inputs: two local Dates.
 * Outputs: signed civil-day difference.
 * Side effects: none.
 */
export function civilDaysBetween(to: Date, from: Date): number {
  return Math.round((startOfLocalDay(to) - startOfLocalDay(from)) / 86_400_000);
}

/**
 * Purpose: English ordinal for statement/due copy (15 → 15th).
 * Inputs: day of month.
 * Outputs: short ordinal string.
 * Side effects: none.
 */
export function dayOrdinal(day: number): string {
  const safe = Math.min(31, Math.max(1, Math.floor(day)));
  const teens = safe % 100;
  if (teens >= 11 && teens <= 13) {
    return `${safe}th`;
  }
  switch (safe % 10) {
    case 1:
      return `${safe}st`;
    case 2:
      return `${safe}nd`;
    case 3:
      return `${safe}rd`;
    default:
      return `${safe}th`;
  }
}

/**
 * Purpose: ok / due soon / overdue for one card from calendar days + optional amount due.
 * Inputs: days until next due, whether last due already passed, optional amount still due.
 * Outputs: status plus girlfriend label.
 * Side effects: none.
 * Design decisions: overdue only when an amount due is still set after the due day — we do not invent unpaid.
 */
export function cardHealthStatus(
  daysToDue: number,
  lastDuePassed: boolean,
  amountDue?: number,
): { status: CardHealthStatus; statusLabel: string } {
  const unpaid = amountDue !== undefined && Number.isFinite(amountDue) && amountDue > 0;
  if (lastDuePassed && unpaid) {
    return { status: 'overdue', statusLabel: 'overdue' };
  }
  if (daysToDue <= 7) {
    return { status: 'soon', statusLabel: daysToDue <= 0 ? 'due today' : 'due soon' };
  }
  return { status: 'ok', statusLabel: 'ok' };
}

/**
 * Purpose: Card Health rows for Money — days-to-due, amount, statement vs due, traffic light.
 * Inputs: card accounts, reporting currency, now.
 * Outputs: rows sorted soonest due first.
 * Side effects: none.
 */
export function cardHealthFor(
  cards: CreditCardAccount[],
  currency: MoneyCurrency,
  now: Date = new Date(),
): CardHealthRow[] {
  return cards
    .map((card) => {
      const dueDate = nextOrSameDayOfMonth(card.dueDayOfMonth, now);
      const statementDate = nextOrSameDayOfMonth(card.statementDayOfMonth, now);
      const daysToDue = civilDaysBetween(dueDate, now);
      const lastDue = previousDayOfMonth(card.dueDayOfMonth, now);
      const lastDuePassed = civilDaysBetween(now, lastDue) > 0 && daysToDue > 0;
      const { status, statusLabel } = cardHealthStatus(daysToDue, lastDuePassed, card.amountDue);
      const amountPart =
        card.amountDue !== undefined ? ` · ${formatMoney(card.amountDue, currency)} due` : '';
      const dueLine =
        daysToDue <= 0 ? `Due today${amountPart}` : `${daysToDue} day${daysToDue === 1 ? '' : 's'} to due${amountPart}`;
      return {
        id: card.id,
        name: card.name,
        daysToDue,
        dueDate,
        statementDate,
        amountDue: card.amountDue,
        status,
        statusLabel,
        dueLine,
        cycleLine: `Statement on the ${dayOrdinal(card.statementDayOfMonth)} · due on the ${dayOrdinal(card.dueDayOfMonth)}`,
      };
    })
    .sort((left, right) => left.daysToDue - right.daysToDue || left.name.localeCompare(right.name));
}
