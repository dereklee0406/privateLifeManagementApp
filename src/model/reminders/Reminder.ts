import type { ReminderKind } from './kinds';
import { toDayKey } from '../../utils/dateUtils';

/**
 * Purpose: JS weekday index so next-fire can use Date.getDay() without mapping tables.
 * Inputs: 0 = Sunday … 6 = Saturday.
 */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Purpose: monthly chip — this civil day, the 1st, or the last calendar day.
 * Inputs: compose “This date / Start of month / End of month”.
 * Outputs: stored on monthly Recurrence; missing means “this date” (legacy rows).
 */
export type MonthAnchor = 'date' | 'start' | 'end';

/**
 * Purpose: how a reminder repeats, including a one-shot civil date.
 * Inputs: editor pickers.
 * Outputs: stored JSON plus nextFireAt().
 * Side effects: none.
 * Design decisions: interval rules keep an anchor timestamp; `once.dayKey` is YYYY-MM-DD local.
 *   Monthly `monthAnchor: 'end'` fires on Feb 28/29 (leap) and 30/31 other months — not a stored 31st that only clamps.
 */
export type Recurrence =
  | { type: 'once'; dayKey: string }
  | { type: 'daily' }
  | { type: 'weekly'; weekdays: Weekday[] }
  | { type: 'monthly'; dayOfMonth: number; monthAnchor?: MonthAnchor }
  | { type: 'yearly'; month: number; day: number }
  | { type: 'every-n-days'; interval: number }
  | { type: 'every-n-weeks'; interval: number; weekday: Weekday }
  | { type: 'every-n-months'; interval: number; dayOfMonth: number };

export type RecurrenceType = Recurrence['type'];

/**
 * Purpose: list/calendar urgency, independent of kind or category.
 */
export type ReminderPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Purpose: which ping a credit-card child reminder represents.
 */
export type CreditCardPingRole = 'statement' | 'due' | 'custom';

/**
 * Purpose: a local reminder the writer can enable, edit, and delete.
 * Inputs: ReminderController create/update.
 * Outputs: JSON-serializable record (PIN is never stored here).
 * Side effects: none.
 * Design decisions: next fire is computed, not stored; credit-card fields live on CreditCardAccount plus child rows.
 */
export interface Reminder {
  id: string;
  kind: ReminderKind;
  title: string;
  note?: string;
  hour: number;
  minute: number;
  enabled: boolean;
  recurrence: Recurrence;
  priority: ReminderPriority;
  /** Top / sub / type path from the category tree. */
  categoryPath: ReminderCategoryPath;
  /** ISO time used as the origin for interval recurrences. */
  anchorAt: string;
  templateId?: string;
  /** When set, this row is a ping owned by a CreditCardAccount. */
  accountId?: string;
  pingRole?: CreditCardPingRole;
  /** ISO timestamp of the most recent 1-tap completion. */
  lastCompletedAt?: string;
  /** Civil day keys (YYYY-MM-DD) when this habit was checked off — streak / completed-today. */
  completedDayKeys?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Purpose: location of a reminder in the category taxonomy.
 * Inputs: category picker.
 * Outputs: stored on each Reminder for filters.
 * Side effects: none.
 */
export interface ReminderCategoryPath {
  top: string;
  subcategory?: string;
  type?: string;
}

/**
 * Purpose: editor payload without persistence timestamps.
 */
export interface ReminderDraft {
  kind: ReminderKind;
  title: string;
  note: string;
  hour: number;
  minute: number;
  enabled: boolean;
  recurrence: Recurrence;
  priority: ReminderPriority;
  categoryPath: ReminderCategoryPath;
  templateId?: string;
  accountId?: string;
  pingRole?: CreditCardPingRole;
  lastCompletedAt?: string;
  completedDayKeys?: string[];
}

/**
 * Purpose: whether a reminder was already checked off for today’s civil day.
 * Inputs: reminder, optional local now.
 * Outputs: true when lastCompletedAt falls on today or today is in completedDayKeys.
 * Side effects: none.
 * Design decisions: either field alone is enough so older partial writes still work.
 */
export function isReminderCompletedToday(reminder: Reminder, now: Date = new Date()): boolean {
  const today = toDayKey(now);
  if (reminder.completedDayKeys?.includes(today)) {
    return true;
  }
  if (!reminder.lastCompletedAt) {
    return false;
  }
  const completedAt = new Date(reminder.lastCompletedAt);
  if (Number.isNaN(completedAt.getTime())) {
    return false;
  }
  return toDayKey(completedAt) === today;
}

export type { ReminderKind } from './kinds';
export { REMINDER_KINDS } from './kinds';

export const REMINDER_PRIORITIES: ReminderPriority[] = ['low', 'normal', 'high', 'urgent'];

export const RECURRENCE_TYPES: RecurrenceType[] = [
  'once',
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'every-n-days',
  'every-n-weeks',
  'every-n-months',
];
