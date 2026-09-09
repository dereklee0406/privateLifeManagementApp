import { nextFireAt } from './nextFire';
import type { Reminder } from './Reminder';
import { toDayKey } from '../../utils/dateUtils';

export interface UpcomingReminder {
  reminder: Reminder;
  fireAt: Date | null;
}

export interface UpcomingGroup {
  id: 'today' | 'tomorrow' | 'week' | 'later' | 'none';
  title: string;
  items: UpcomingReminder[];
}

/**
 * Purpose: group enabled reminders by next fire for the list screen.
 * Inputs: reminders and now.
 * Outputs: Today / Tomorrow / This week / Later / No upcoming.
 * Side effects: none.
 */
export function groupRemindersByUpcoming(reminders: Reminder[], now: Date = new Date()): UpcomingGroup[] {
  const todayKey = toDayKey(now);
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrowKey = toDayKey(tomorrow);
  const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);

  const buckets: Record<UpcomingGroup['id'], UpcomingReminder[]> = {
    today: [],
    tomorrow: [],
    week: [],
    later: [],
    none: [],
  };

  for (const reminder of reminders) {
    const fireAt = reminder.enabled ? nextFireAt(reminder, now) : null;
    const item: UpcomingReminder = { reminder, fireAt };
    if (!fireAt) {
      buckets.none.push(item);
      continue;
    }
    const key = toDayKey(fireAt);
    if (key === todayKey) {
      buckets.today.push(item);
    } else if (key === tomorrowKey) {
      buckets.tomorrow.push(item);
    } else if (fireAt.getTime() <= weekEnd.getTime()) {
      buckets.week.push(item);
    } else {
      buckets.later.push(item);
    }
  }

  const sortByFire = (items: UpcomingReminder[]) =>
    [...items].sort((left, right) => {
      const leftTime = left.fireAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightTime = right.fireAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    });

  const titles: Record<UpcomingGroup['id'], string> = {
    today: 'Today',
    tomorrow: 'Tomorrow',
    week: 'This week',
    later: 'Later',
    none: 'No upcoming fire',
  };

  return (['today', 'tomorrow', 'week', 'later', 'none'] as const)
    .map((id) => ({ id, title: titles[id], items: sortByFire(buckets[id]) }))
    .filter((group) => group.items.length > 0);
}

/**
 * Purpose: reminders whose next or same-day fire lands on a civil day (calendar agenda).
 * Inputs: reminders, YYYY-MM-DD, now.
 * Outputs: matching UpcomingReminder rows.
 * Side effects: none.
 * Design decisions: a monthly reminder is listed on its next occurrence day, and also if that day-of-month matches the selected day in the visible month via nextFireTimes-style check: we treat “fires on this civil day” if nextFireAt from start-of-day-minus-1s lands on dayKey.
 */
export function remindersOnDay(reminders: Reminder[], dayKey: string, now: Date = new Date()): UpcomingReminder[] {
  const [year, month, day] = dayKey.split('-').map(Number);
  const start = new Date(year, (month ?? 1) - 1, day ?? 1, 0, 0, 0, 0);
  const justBefore = new Date(start.getTime() - 1000);
  return reminders
    .filter((item) => item.enabled)
    .map((reminder) => {
      const fireAt = nextFireAt(reminder, justBefore);
      return { reminder, fireAt };
    })
    .filter((item) => item.fireAt && toDayKey(item.fireAt) === dayKey)
    .sort((left, right) => (left.fireAt?.getTime() ?? 0) - (right.fireAt?.getTime() ?? 0));
}
