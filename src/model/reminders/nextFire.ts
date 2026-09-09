import { isReminderCompletedToday, type MonthAnchor, type Recurrence, type Reminder, type Weekday } from './Reminder';

/**
 * Purpose: inputs next-fire needs without requiring a persisted Reminder id.
 * Inputs: recurrence, clock time, and interval anchor.
 * Outputs: used by nextFireAt / nextFireTimes.
 * Side effects: none.
 */
export interface NextFireInput {
  recurrence: Recurrence;
  hour: number;
  minute: number;
  anchorAt: string;
}

/**
 * Purpose: last civil day of a local month (monthIndex 0–11).
 * Inputs: year and month index.
 * Outputs: 28–31.
 * Side effects: none.
 */
export function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Purpose: clamp 31 Jan / 29 Feb style dates onto a real civil day.
 * Inputs: year, 1–12 month, requested day.
 * Outputs: a valid day-of-month for that year/month.
 * Side effects: none.
 */
export function clampDayOfMonth(year: number, month: number, day: number): number {
  const monthIndex = Math.min(11, Math.max(0, month - 1));
  const last = lastDayOfMonth(year, monthIndex);
  return Math.min(Math.max(1, day), last);
}

/**
 * Purpose: civil day a monthly rule fires on in a given year/month (0-based monthIndex).
 * Inputs: year, monthIndex, monthly dayOfMonth + optional monthAnchor.
 * Outputs: 1 (start), last calendar day 28–31 (end), or clamped this-date.
 * Side effects: none.
 * Design decisions: end-of-month uses lastDayOfMonth so February is 29 in leap years and 28 otherwise.
 *   This-date 31 still clamps (Apr 30, Feb 28/29) but stays “the 31st when it exists”.
 */
export function civilDayForMonthly(
  year: number,
  monthIndex: number,
  rule: { dayOfMonth: number; monthAnchor?: MonthAnchor },
): number {
  if (rule.monthAnchor === 'end') {
    return lastDayOfMonth(year, monthIndex);
  }
  if (rule.monthAnchor === 'start') {
    return 1;
  }
  return clampDayOfMonth(year, monthIndex + 1, rule.dayOfMonth);
}

/**
 * Purpose: reject recurrences the editor should not save.
 * Inputs: Recurrence union.
 * Outputs: true when next-fire can produce a date.
 * Side effects: none.
 */
export function isValidRecurrence(recurrence: Recurrence): boolean {
  switch (recurrence.type) {
    case 'daily':
      return true;
    case 'weekly':
      return recurrence.weekdays.length > 0;
    case 'monthly':
      return recurrence.dayOfMonth >= 1 && recurrence.dayOfMonth <= 31;
    case 'yearly':
      return recurrence.month >= 1 && recurrence.month <= 12 && recurrence.day >= 1 && recurrence.day <= 31;
    case 'every-n-days':
      return recurrence.interval >= 1;
    case 'every-n-weeks':
      return recurrence.interval >= 1 && recurrence.weekday >= 0 && recurrence.weekday <= 6;
    case 'every-n-months':
      return recurrence.interval >= 1 && recurrence.dayOfMonth >= 1 && recurrence.dayOfMonth <= 31;
    case 'once':
      return /^\d{4}-\d{2}-\d{2}$/.test(recurrence.dayKey);
    default:
      return false;
  }
}

/**
 * Purpose: how many upcoming DATE notifications to pre-schedule for a rule.
 * Inputs: recurrence.
 * Outputs: horizon count (covers weeks without opening the app).
 * Side effects: none.
 * Design decisions: the OS is given a window of one-shot fires; app launch refills the window.
 */
export function scheduleHorizon(recurrence: Recurrence): number {
  switch (recurrence.type) {
    case 'daily':
      return 21;
    case 'weekly':
      return 12;
    case 'monthly':
      return 6;
    case 'yearly':
      return 2;
    case 'every-n-days':
      return Math.min(24, Math.max(8, Math.ceil(60 / Math.max(1, recurrence.interval))));
    case 'every-n-weeks':
      return 12;
    case 'every-n-months':
      return 6;
    case 'once':
      return 1;
    default:
      return 8;
  }
}

/**
 * Purpose: next local fire strictly after `now`, or null when the rule is invalid.
 * Inputs: reminder-like clock fields and a reference instant.
 * Outputs: Date in local time, seconds/ms zeroed.
 * Side effects: none.
 * Design decisions: calendar math (not raw ms) so DST does not skip a civil day.
 *   When the reminder was completed today, search starts after today so today’s ping is skipped.
 */
export function nextFireAt(input: NextFireInput | Reminder, now: Date): Date | null {
  if (!isValidRecurrence(input.recurrence)) {
    return null;
  }
  const cursor =
    'lastCompletedAt' in input || 'completedDayKeys' in input
      ? isReminderCompletedToday(input as Reminder, now)
        ? startOfNextLocalDay(now)
        : now
      : now;
  const hour = clampHour(input.hour);
  const minute = clampMinute(input.minute);
  switch (input.recurrence.type) {
    case 'daily':
      return nextDaily(hour, minute, cursor);
    case 'weekly':
      return nextWeekly(input.recurrence.weekdays, hour, minute, cursor);
    case 'monthly':
      return nextMonthly(input.recurrence, hour, minute, cursor);
    case 'yearly':
      return nextYearly(input.recurrence.month, input.recurrence.day, hour, minute, cursor);
    case 'every-n-days':
      return nextEveryNDays(input.recurrence.interval, hour, minute, input.anchorAt, cursor);
    case 'every-n-weeks':
      return nextEveryNWeeks(input.recurrence.interval, input.recurrence.weekday, hour, minute, input.anchorAt, cursor);
    case 'every-n-months':
      return nextEveryNMonths(input.recurrence.interval, input.recurrence.dayOfMonth, hour, minute, input.anchorAt, cursor);
    case 'once':
      return nextOnce(input.recurrence.dayKey, hour, minute, cursor);
    default:
      return null;
  }
}

/**
 * Purpose: local midnight of the next civil day after `now`.
 * Inputs: reference instant.
 * Outputs: Date at 00:00:00.000 local.
 * Side effects: none.
 */
function startOfNextLocalDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
}

/**
 * Purpose: upcoming fire instants for native DATE scheduling.
 * Inputs: rule, now, how many dates to emit.
 * Outputs: strictly increasing Dates.
 * Side effects: none.
 */
export function nextFireTimes(input: NextFireInput | Reminder, now: Date, count: number): Date[] {
  const times: Date[] = [];
  let cursor = now;
  for (let i = 0; i < count; i += 1) {
    const next = nextFireAt(input, cursor);
    if (!next || next.getTime() <= cursor.getTime()) {
      break;
    }
    times.push(next);
    cursor = new Date(next.getTime() + 1000);
  }
  return times;
}

function clampHour(hour: number): number {
  return Math.min(23, Math.max(0, Math.floor(hour)));
}

function clampMinute(minute: number): number {
  return Math.min(59, Math.max(0, Math.floor(minute)));
}

function withClock(date: Date, hour: number, minute: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);
}

function addCalendarDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function civilDayDiff(later: Date, earlier: Date): number {
  const a = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
  const b = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  return Math.round((a - b) / 86_400_000);
}

function nextDaily(hour: number, minute: number, now: Date): Date {
  const today = withClock(now, hour, minute);
  if (today.getTime() > now.getTime()) {
    return today;
  }
  return withClock(addCalendarDays(today, 1), hour, minute);
}

function nextOnce(dayKey: string, hour: number, minute: number, now: Date): Date | null {
  const [year, month, day] = dayKey.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }
  const fire = new Date(year, month - 1, day, hour, minute, 0, 0);
  return fire.getTime() > now.getTime() ? fire : null;
}

function nextWeekly(weekdays: Weekday[], hour: number, minute: number, now: Date): Date | null {
  const wanted = [...new Set(weekdays)].filter((day) => day >= 0 && day <= 6);
  if (wanted.length === 0) {
    return null;
  }
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = withClock(addCalendarDays(now, offset), hour, minute);
    if (wanted.includes(day.getDay() as Weekday) && day.getTime() > now.getTime()) {
      return day;
    }
  }
  return null;
}

function nextMonthly(
  recurrence: Extract<Recurrence, { type: 'monthly' }>,
  hour: number,
  minute: number,
  now: Date,
): Date {
  const build = (year: number, monthIndex: number): Date => {
    const day = civilDayForMonthly(year, monthIndex, recurrence);
    return new Date(year, monthIndex, day, hour, minute, 0, 0);
  };
  const thisMonth = build(now.getFullYear(), now.getMonth());
  if (thisMonth.getTime() > now.getTime()) {
    return thisMonth;
  }
  const nextIndex = now.getMonth() + 1;
  return build(now.getFullYear() + Math.floor(nextIndex / 12), nextIndex % 12);
}

function nextYearly(month: number, day: number, hour: number, minute: number, now: Date): Date {
  const build = (year: number): Date => {
    const clamped = clampDayOfMonth(year, month, day);
    return new Date(year, month - 1, clamped, hour, minute, 0, 0);
  };
  const thisYear = build(now.getFullYear());
  if (thisYear.getTime() > now.getTime()) {
    return thisYear;
  }
  return build(now.getFullYear() + 1);
}

function nextEveryNDays(interval: number, hour: number, minute: number, anchorAt: string, now: Date): Date {
  const step = Math.max(1, Math.floor(interval));
  const origin = withClock(new Date(anchorAt), hour, minute);
  if (origin.getTime() > now.getTime()) {
    return origin;
  }
  const daysPassed = civilDayDiff(now, origin);
  const steps = Math.max(0, Math.floor(daysPassed / step));
  let candidate = withClock(addCalendarDays(origin, steps * step), hour, minute);
  while (candidate.getTime() <= now.getTime()) {
    candidate = withClock(addCalendarDays(candidate, step), hour, minute);
  }
  return candidate;
}

function firstWeekdayOnOrAfter(from: Date, weekday: Weekday, hour: number, minute: number): Date {
  const start = withClock(from, hour, minute);
  const delta = (weekday - start.getDay() + 7) % 7;
  const sameWeek = withClock(addCalendarDays(start, delta), hour, minute);
  if (sameWeek.getTime() >= from.getTime()) {
    return sameWeek;
  }
  return withClock(addCalendarDays(sameWeek, 7), hour, minute);
}

function nextEveryNWeeks(
  interval: number,
  weekday: Weekday,
  hour: number,
  minute: number,
  anchorAt: string,
  now: Date,
): Date {
  const stepDays = Math.max(1, Math.floor(interval)) * 7;
  const first = firstWeekdayOnOrAfter(new Date(anchorAt), weekday, hour, minute);
  if (first.getTime() > now.getTime()) {
    return first;
  }
  const daysPassed = civilDayDiff(now, first);
  const steps = Math.max(0, Math.floor(daysPassed / stepDays));
  let candidate = withClock(addCalendarDays(first, steps * stepDays), hour, minute);
  while (candidate.getTime() <= now.getTime()) {
    candidate = withClock(addCalendarDays(candidate, stepDays), hour, minute);
  }
  return candidate;
}

function nextEveryNMonths(
  interval: number,
  dayOfMonth: number,
  hour: number,
  minute: number,
  anchorAt: string,
  now: Date,
): Date {
  const step = Math.max(1, Math.floor(interval));
  const anchor = new Date(anchorAt);
  const build = (year: number, monthIndex: number): Date => {
    const day = clampDayOfMonth(year, monthIndex + 1, dayOfMonth);
    return new Date(year, monthIndex, day, hour, minute, 0, 0);
  };
  const monthsAhead = (now.getFullYear() - anchor.getFullYear()) * 12 + (now.getMonth() - anchor.getMonth());
  const steps = Math.max(0, Math.floor(monthsAhead / step));
  const shift = (extra: number): Date => {
    const total = steps * step + extra;
    const monthTotal = anchor.getMonth() + total;
    const year = anchor.getFullYear() + Math.floor(monthTotal / 12);
    const monthIndex = ((monthTotal % 12) + 12) % 12;
    return build(year, monthIndex);
  };
  let extra = 0;
  let candidate = shift(0);
  while (candidate.getTime() <= now.getTime()) {
    extra += 1;
    candidate = shift(extra);
  }
  return candidate;
}
