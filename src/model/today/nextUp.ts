import type { CreditCardAccount } from '../reminders/creditCards';
import { nextFireAt } from '../reminders/nextFire';
import { isReminderCompletedToday, type Reminder } from '../reminders/Reminder';
import type { MoneyCurrency } from '../settings/AppSettings';
import { startOfLocalDay } from '../journal/journalStats';
import { previousDayOfMonth, nextOrSameDayOfMonth, civilDaysBetween } from '../finance/cardHealth';
import { formatFriendlyMoney } from '../finance/Expense';

export type NextUpDueStatus = 'overdue' | 'today' | 'tomorrow' | 'future';

export interface NextUpCard {
  /** Reminder or credit-card id for 1-tap complete / navigation. */
  id: string;
  itemType: 'reminder' | 'card';
  /** True when a reminder was already checked off today (usually filtered out of Next Up). */
  isCompleted: boolean;
  title: string;
  dueStatus: NextUpDueStatus;
  dueLabel: string;
  /** Signed civil days from today to due (negative = overdue). */
  days: number;
  amountDue?: number;
  amountLabel?: string;
  href: string;
  dueAt: Date;
  line: string;
}

const STATUS_RANK: Record<NextUpDueStatus, number> = {
  overdue: 0,
  today: 1,
  tomorrow: 2,
  future: 3,
};

const STATUS_LABEL: Record<NextUpDueStatus, string> = {
  overdue: 'Overdue',
  today: 'Today',
  tomorrow: 'Tomorrow',
  future: 'Future',
};

/**
 * Purpose: civil-day due bucket for Next Up (Overdue > Today > Tomorrow > Future).
 * Inputs: signed whole days from today to the due civil day.
 * Outputs: status id.
 * Side effects: none.
 */
export function dueStatusFromDays(days: number): NextUpDueStatus {
  if (days < 0) {
    return 'overdue';
  }
  if (days === 0) {
    return 'today';
  }
  if (days === 1) {
    return 'tomorrow';
  }
  return 'future';
}

/**
 * Purpose: once-reminder fire instant even when it already passed (nextFireAt would be null).
 * Inputs: reminder.
 * Outputs: local Date or null when the day key is unusable.
 * Side effects: none.
 * Design decisions: civil day 1 is valid — `!day` would drop the 1st of the month.
 */
export function onceFireAt(reminder: Reminder): Date | null {
  if (reminder.recurrence.type !== 'once') {
    return null;
  }
  const [year, month, day] = reminder.recurrence.dayKey.split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day) || day < 1) {
    return null;
  }
  return new Date(year, month - 1, day, reminder.hour, reminder.minute, 0, 0);
}

/**
 * Purpose: parse an optional amount due from a reminder note (card pings: “Amount due 1200”).
 * Inputs: optional note.
 * Outputs: number or undefined.
 * Side effects: none.
 */
export function amountDueFromNote(note?: string): number | undefined {
  if (!note) {
    return undefined;
  }
  const match = /Amount due\s+([\d.]+)/i.exec(note);
  if (!match) {
    return undefined;
  }
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * Purpose: nearest enabled reminder or card bill for the Today Next Up card.
 * Inputs: reminders, credit cards, reporting currency, now.
 * Outputs: one card or null when nothing is enabled.
 * Side effects: none.
 * Design decisions: skip child card pings and use the parent card so amount due is not duplicated;
 *   overdue once-reminders still surface because nextFireAt only looks forward;
 *   reminders already completed today are filtered out so Next Up advances to the next item.
 */
export function nextUpCard(
  reminders: Reminder[],
  creditCards: CreditCardAccount[],
  currency: MoneyCurrency,
  now: Date = new Date(),
): NextUpCard | null {
  const candidates: NextUpCard[] = [];

  for (const card of creditCards) {
    const nextDue = nextOrSameDayOfMonth(card.dueDayOfMonth, now);
    const lastDue = previousDayOfMonth(card.dueDayOfMonth, now);
    const daysToDue = civilDaysBetween(nextDue, now);
    const unpaid = card.amountDue !== undefined && Number.isFinite(card.amountDue) && card.amountDue > 0;
    const lastDuePassed = civilDaysBetween(now, lastDue) > 0 && daysToDue > 0;
    const overdue = lastDuePassed && unpaid;
    const dueAt = overdue ? lastDue : nextDue;
    const days = civilDaysBetween(dueAt, now);
    candidates.push(
      toNextUp({
        id: card.id,
        itemType: 'card',
        isCompleted: false,
        title: card.name,
        dueAt,
        days,
        href: `/reminders/card/${card.id}`,
        amountDue: card.amountDue,
        currency,
      }),
    );
  }

  for (const item of reminders) {
    if (!item.enabled || item.accountId) {
      continue;
    }
    if (isReminderCompletedToday(item, now)) {
      continue;
    }
    const dueAt = item.recurrence.type === 'once' ? onceFireAt(item) : nextFireAt(item, now);
    if (!dueAt) {
      continue;
    }
    const days = Math.round((startOfLocalDay(dueAt) - startOfLocalDay(now)) / 86_400_000);
    candidates.push(
      toNextUp({
        id: item.id,
        itemType: 'reminder',
        isCompleted: false,
        title: item.title,
        dueAt,
        days,
        href: `/reminders/${item.id}`,
        amountDue: amountDueFromNote(item.note),
        currency,
      }),
    );
  }

  candidates.sort((left, right) => {
    const rank = STATUS_RANK[left.dueStatus] - STATUS_RANK[right.dueStatus];
    if (rank !== 0) {
      return rank;
    }
    if (left.dueStatus === 'overdue') {
      return right.dueAt.getTime() - left.dueAt.getTime();
    }
    return left.dueAt.getTime() - right.dueAt.getTime();
  });

  return candidates[0] ?? null;
}

function toNextUp(input: {
  id: string;
  itemType: 'reminder' | 'card';
  isCompleted: boolean;
  title: string;
  dueAt: Date;
  days: number;
  href: string;
  amountDue?: number;
  currency: MoneyCurrency;
}): NextUpCard {
  const dueStatus = dueStatusFromDays(input.days);
  const dueLabel = STATUS_LABEL[dueStatus];
  const amountLabel =
    input.amountDue !== undefined && Number.isFinite(input.amountDue) && input.amountDue > 0
      ? formatFriendlyMoney(input.amountDue, input.currency)
      : undefined;
  return {
    id: input.id,
    itemType: input.itemType,
    isCompleted: input.isCompleted,
    title: input.title,
    dueStatus,
    dueLabel,
    days: input.days,
    amountDue: amountLabel ? input.amountDue : undefined,
    amountLabel,
    href: input.href,
    dueAt: input.dueAt,
    line: amountLabel ? `${dueLabel} · ${amountLabel}` : dueLabel,
  };
}
