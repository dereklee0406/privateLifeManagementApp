import { nextOrSameDayOfMonth } from '../model/finance/cardHealth';
import { clampDayOfMonth } from '../model/reminders/nextFire';
import { isoAtLocalNoon, toDayKey } from '../utils/dateUtils';

/**
 * Purpose: map calendar-picker Date values to stored Model shapes (ISO day keys, civil day-of-month, month+day, budget year/month).
 * Inputs: picker Date or stored fields.
 * Outputs: Model-ready primitives; picker Dates at local noon.
 * Side effects: none.
 * Design decisions: DateField only speaks Date; screens and controllers call these helpers so Models stay ISO / day numbers, not picker objects.
 */

function atLocalNoon(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0);
}

/**
 * Purpose: YYYY-MM-DD from a picker Date (local civil day).
 */
export function dayKeyFromDate(value: Date): string {
  return toDayKey(value);
}

/**
 * Purpose: picker Date for a stored YYYY-MM-DD key.
 * Inputs: day key; fallback Date when the key is missing or malformed.
 */
export function dateFromDayKey(dayKey: string, fallback: Date = new Date()): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    return atLocalNoon(fallback);
  }
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0);
}

/**
 * Purpose: 1–31 day-of-month stored on monthly reminders and card statement/due.
 */
export function dayOfMonthFromDate(value: Date): number {
  return Math.min(31, Math.max(1, value.getDate()));
}

/**
 * Purpose: next (or today) occurrence of a stored day-of-month, for opening the picker on a real calendar date.
 */
export function dateFromDayOfMonth(dayOfMonth: number, now: Date = new Date()): Date {
  return nextOrSameDayOfMonth(dayOfMonth, now);
}

/**
 * Purpose: yearly / anniversary month (1–12) + day from a picker Date.
 */
export function monthDayFromDate(value: Date): { month: number; day: number } {
  return { month: value.getMonth() + 1, day: value.getDate() };
}

/**
 * Purpose: next (or today) occurrence of a stored month+day for the yearly picker.
 */
export function dateFromMonthDay(month: number, day: number, now: Date = new Date()): Date {
  const safeMonth = Math.min(12, Math.max(1, month));
  const year = now.getFullYear();
  const thisYear = new Date(year, safeMonth - 1, clampDayOfMonth(year, safeMonth, day), 12, 0, 0, 0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  if (thisYear.getTime() >= today.getTime()) {
    return thisYear;
  }
  const nextYear = year + 1;
  return new Date(nextYear, safeMonth - 1, clampDayOfMonth(nextYear, safeMonth, day), 12, 0, 0, 0);
}

/**
 * Purpose: Budget.year + 0-based Budget.month from a picker Date.
 */
export function budgetMonthFromDate(value: Date): { year: number; month: number } {
  return { year: value.getFullYear(), month: value.getMonth() };
}

/**
 * Purpose: first-of-month picker Date for a stored budget envelope.
 */
export function dateFromBudgetMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex, 1, 12, 0, 0, 0);
}

/**
 * Purpose: journal createdAt — now if the picker day is today, otherwise local noon on that day.
 * Inputs: picker Date and optional now.
 * Outputs: ISO string or undefined (controller treats undefined as “use now”).
 */
export function journalCreatedAtFromDate(value: Date, now: Date = new Date()): string | undefined {
  const key = dayKeyFromDate(value);
  if (key === toDayKey(now)) {
    return undefined;
  }
  return isoAtLocalNoon(key);
}
