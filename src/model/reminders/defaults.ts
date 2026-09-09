import { categoryPathForTemplate } from './categories';
import type { Reminder, ReminderDraft, Recurrence, Weekday, MonthAnchor } from './Reminder';
import type { ReminderKind } from './kinds';
import { makeCategoryPath } from './categories';
import { toDayKey } from '../../utils/dateUtils';

const DEFAULT_HOUR = 21;
const DEFAULT_MINUTE = 0;

/**
 * Purpose: suggested title when the writer picks a kind.
 * Inputs: ReminderKind.
 * Outputs: short title string.
 * Side effects: none.
 */
export function defaultTitleForKind(kind: ReminderKind): string {
  switch (kind) {
    case 'follow-up':
      return 'Continue this';
    case 'goal':
      return 'Goal check-in';
    case 'reflection':
      return 'Time to reflect';
    case 'anniversary':
      return 'Anniversary';
    default:
      return 'Reminder';
  }
}

/**
 * Purpose: notification body when the writer left the note blank.
 * Inputs: ReminderKind.
 * Outputs: lock-screen / tray copy.
 * Side effects: none.
 */
export function defaultBodyForKind(kind: ReminderKind): string {
  switch (kind) {
    case 'follow-up':
      return 'Write or record today';
    case 'goal':
      return 'A small check-in on what you named';
    case 'reflection':
      return 'Write or record today';
    case 'anniversary':
      return 'A date worth a page';
    default:
      return 'Write or record today';
  }
}

/**
 * Purpose: kind-flavored recurrence the editor can still change.
 * Inputs: kind plus “today” so anniversary/yearly defaults to this calendar date.
 * Outputs: Recurrence union.
 * Side effects: none.
 */
export function defaultRecurrenceForKind(kind: ReminderKind, now: Date = new Date()): Recurrence {
  if (kind === 'anniversary') {
    return { type: 'yearly', month: now.getMonth() + 1, day: now.getDate() };
  }
  if (kind === 'goal') {
    return { type: 'weekly', weekdays: [1] };
  }
  if (kind === 'reflection') {
    return { type: 'weekly', weekdays: [0] };
  }
  if (kind === 'follow-up') {
    return { type: 'every-n-days', interval: 2 };
  }
  return { type: 'daily' };
}

/**
 * Purpose: blank editor state for a new reminder.
 * Inputs: kind and local now (time defaults to 21:00).
 * Outputs: ReminderDraft.
 * Side effects: none.
 */
export function blankReminderDraft(kind: ReminderKind = 'reflection', now: Date = new Date()): ReminderDraft {
  return {
    kind,
    title: defaultTitleForKind(kind),
    note: '',
    hour: DEFAULT_HOUR,
    minute: DEFAULT_MINUTE,
    enabled: true,
    recurrence: defaultRecurrenceForKind(kind, now),
    priority: 'normal',
    categoryPath: makeCategoryPath('other'),
    templateId: 'plain',
  };
}

/**
 * Purpose: map a stored reminder back into editor state.
 * Inputs: Reminder record.
 * Outputs: ReminderDraft.
 * Side effects: none.
 */
export function reminderToDraft(reminder: Reminder): ReminderDraft {
  return {
    kind: reminder.kind,
    title: reminder.title,
    note: reminder.note ?? '',
    hour: reminder.hour,
    minute: reminder.minute,
    enabled: reminder.enabled,
    recurrence: reminder.recurrence,
    priority: reminder.priority,
    categoryPath: reminder.categoryPath,
    templateId: reminder.templateId,
    accountId: reminder.accountId,
    pingRole: reminder.pingRole,
  };
}

/**
 * Purpose: monthly recurrence for This date / Start of month / End of month chips.
 * Inputs: chip id and the civil day used when the chip is “This date”.
 * Outputs: monthly Recurrence (start stores day 1, end stores 31 as a placeholder).
 * Side effects: none.
 * Design decisions: next-fire ignores the placeholder on start/end and uses lastDayOfMonth / day 1.
 */
export function monthlyForAnchor(anchor: MonthAnchor, dayOfMonth: number): Recurrence {
  if (anchor === 'start') {
    return { type: 'monthly', dayOfMonth: 1, monthAnchor: 'start' };
  }
  if (anchor === 'end') {
    return { type: 'monthly', dayOfMonth: 31, monthAnchor: 'end' };
  }
  return {
    type: 'monthly',
    dayOfMonth: Math.min(31, Math.max(1, Math.floor(dayOfMonth) || 1)),
    monthAnchor: 'date',
  };
}

/**
 * Purpose: which monthly chip is selected, including legacy rows without monthAnchor.
 * Inputs: current Recurrence.
 * Outputs: date | start | end (non-monthly → date).
 * Side effects: none.
 */
export function monthAnchorFrom(recurrence: Recurrence): MonthAnchor {
  return recurrence.type === 'monthly' ? (recurrence.monthAnchor ?? 'date') : 'date';
}

/**
 * Purpose: switch recurrence type while keeping overlapping fields.
 * Inputs: next type, current rule, and now for missing fields.
 * Outputs: a Recurrence of the requested type.
 * Side effects: none.
 */
export function recurrenceForType(type: Recurrence['type'], current: Recurrence, now: Date = new Date()): Recurrence {
  const weekday = now.getDay() as Weekday;
  const dayOfMonth = now.getDate();
  const currentWeekdays = current.type === 'weekly' ? current.weekdays : [weekday];
  const currentWeekday =
    current.type === 'every-n-weeks' ? current.weekday : (currentWeekdays[0] ?? weekday);
  const currentDay =
    current.type === 'monthly' || current.type === 'every-n-months'
      ? current.dayOfMonth
      : current.type === 'yearly'
        ? current.day
        : dayOfMonth;
  const currentInterval =
    current.type === 'every-n-days' || current.type === 'every-n-weeks' || current.type === 'every-n-months'
      ? current.interval
      : 2;
  switch (type) {
    case 'once':
      return { type: 'once', dayKey: current.type === 'once' ? current.dayKey : toDayKey(now) };
    case 'daily':
      return { type: 'daily' };
    case 'weekly':
      return { type: 'weekly', weekdays: currentWeekdays.length ? currentWeekdays : [weekday] };
    case 'monthly':
      return monthlyForAnchor(
        current.type === 'monthly' ? (current.monthAnchor ?? 'date') : 'date',
        currentDay,
      );
    case 'yearly':
      return {
        type: 'yearly',
        month: current.type === 'yearly' ? current.month : now.getMonth() + 1,
        day: currentDay,
      };
    case 'every-n-days':
      return { type: 'every-n-days', interval: currentInterval };
    case 'every-n-weeks':
      return { type: 'every-n-weeks', interval: currentInterval, weekday: currentWeekday };
    case 'every-n-months':
      return { type: 'every-n-months', interval: currentInterval, dayOfMonth: currentDay };
    default:
      return { type: 'daily' };
  }
}

/**
 * Purpose: deep-link after a tray tap.
 * Inputs: kind.
 * Outputs: Expo Router path.
 * Side effects: none.
 */
export function reminderOpenPath(kind: ReminderKind): string {
  return kind === 'follow-up' ? '/compose' : '/(tabs)/calendar/reminders';
}

export { categoryPathForTemplate };
