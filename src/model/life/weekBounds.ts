import { toDayKey } from '../../utils/dateUtils';
import type { WeekStart } from '../settings/AppSettings';

export interface WeekRange {
  start: Date;
  end: Date;
  startKey: string;
  endKey: string;
}

/**
 * Purpose: first local calendar day of the week containing `now`.
 * Inputs: reference instant; weekStart Sunday or Monday (default Monday).
 * Outputs: local Date at 00:00 of that first day.
 * Side effects: none.
 * Design decisions: default Monday is HK-first Halo. Calendar used to be Sunday-first via
 *   Date.getDay(); Calendar month grid and Today/You This week now share this same weekStart.
 */
export function startOfWeek(now: Date = new Date(), weekStart: WeekStart = 'monday'): Date {
  const day = now.getDay();
  const startDow = weekStart === 'sunday' ? 0 : 1;
  const offset = (day - startDow + 7) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
}

/**
 * Purpose: last local calendar day of the week containing `now`.
 * Inputs: now and weekStart.
 * Outputs: local Date at start of that last day (Sunday when week starts Monday; Saturday when Sunday).
 * Side effects: none.
 */
export function endOfWeek(now: Date = new Date(), weekStart: WeekStart = 'monday'): Date {
  const start = startOfWeek(now, weekStart);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
}

/**
 * Purpose: this week so far — week-start through today (inclusive).
 * Inputs: now and weekStart.
 * Outputs: start/end Dates and YYYY-MM-DD keys.
 * Side effects: none.
 * Design decisions: “this week” on Tuesday does not invent later-week spend.
 */
export function thisWeekSoFar(now: Date = new Date(), weekStart: WeekStart = 'monday'): WeekRange {
  const start = startOfWeek(now, weekStart);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { start, end, startKey: toDayKey(start), endKey: toDayKey(end) };
}

/**
 * Purpose: previous full week (closed), using the same weekStart as This week.
 * Inputs: now and weekStart.
 * Outputs: start/end Dates and YYYY-MM-DD keys.
 * Side effects: none.
 */
export function lastFullWeek(now: Date = new Date(), weekStart: WeekStart = 'monday'): WeekRange {
  const thisStart = startOfWeek(now, weekStart);
  const start = new Date(thisStart.getFullYear(), thisStart.getMonth(), thisStart.getDate() - 7);
  const end = new Date(thisStart.getFullYear(), thisStart.getMonth(), thisStart.getDate() - 1);
  return { start, end, startKey: toDayKey(start), endKey: toDayKey(end) };
}

/**
 * Purpose: whole current week for upcoming-reminder counts (start day through last day).
 * Inputs: now and weekStart.
 * Outputs: start/end Dates and keys (end is the last day of the week, not today).
 * Side effects: none.
 */
export function thisCalendarWeek(now: Date = new Date(), weekStart: WeekStart = 'monday'): WeekRange {
  const start = startOfWeek(now, weekStart);
  const end = endOfWeek(now, weekStart);
  return { start, end, startKey: toDayKey(start), endKey: toDayKey(end) };
}
