import type { CreditCardAccount } from '../reminders/creditCards';
import type { MoneyCurrency } from '../settings/AppSettings';
import { cardHealthFor, civilDaysBetween, previousDayOfMonth } from './cardHealth';
import { daysUntilRenewal } from './subscriptionCockpit';
import { resolveRecurringSpendFrequency, type RecurringSpend } from './recurringSpend';

/**
 * Purpose: one Wallet Upcoming row — a card bill or a subscription renewal.
 * Inputs: listUpcomingMoney.
 * Outputs: language-free sort key + href. View localizes status.
 * Side effects: none.
 */
export type UpcomingMoneyKind = 'card' | 'subscription';
export type UpcomingMoneyStatus = 'overdue' | 'today' | 'soon' | 'later';

export interface UpcomingMoneyItem {
  id: string;
  kind: UpcomingMoneyKind;
  title: string;
  daysUntil: number;
  href: string;
  amount?: number;
  currency?: MoneyCurrency;
  status: UpcomingMoneyStatus;
}

/** Same 14-day horizon as the subscriptions cockpit upcoming strip. */
export const UPCOMING_MONEY_HORIZON_DAYS = 14;

/**
 * Purpose: map signed days-until onto a status chip.
 * Inputs: daysUntil (negative = overdue).
 * Outputs: UpcomingMoneyStatus.
 * Side effects: none.
 */
export function upcomingMoneyStatus(daysUntil: number): UpcomingMoneyStatus {
  if (daysUntil < 0) {
    return 'overdue';
  }
  if (daysUntil === 0) {
    return 'today';
  }
  if (daysUntil <= 7) {
    return 'soon';
  }
  return 'later';
}

/**
 * Purpose: bills + subs due for Wallet Upcoming — reuse card health + renewal math.
 * Inputs: credit cards, recurring spends, home currency, now.
 * Outputs: sorted UpcomingMoneyItem[] (overdue first, then soonest). Daily coffee rules omitted.
 * Side effects: none.
 * Design decisions: cards use cardHealthFor so rebate/due engines stay the source of truth.
 *   Overdue unpaid cards sort with negative days. Subs reuse daysUntilRenewal. Currency
 *   mismatch skips a sub (no live FX). Empty array is a real empty Upcoming — do not invent.
 */
export function listUpcomingMoney(
  cards: CreditCardAccount[],
  recurring: RecurringSpend[],
  currency: MoneyCurrency,
  now: Date = new Date(),
): UpcomingMoneyItem[] {
  const items: UpcomingMoneyItem[] = [];

  for (const row of cardHealthFor(cards, currency, now)) {
    let daysUntil = row.daysToDue;
    if (row.status === 'overdue') {
      const lastDue = previousDayOfMonth(
        cards.find((card) => card.id === row.id)?.dueDayOfMonth ?? now.getDate(),
        now,
      );
      daysUntil = -Math.max(1, civilDaysBetween(now, lastDue));
    } else if (row.status === 'ok' && row.daysToDue > UPCOMING_MONEY_HORIZON_DAYS) {
      continue;
    }
    items.push({
      id: row.id,
      kind: 'card',
      title: row.name,
      daysUntil,
      href: `/reminders/card/${row.id}`,
      amount: row.amountDue,
      currency,
      status: upcomingMoneyStatus(daysUntil),
    });
  }

  for (const item of recurring) {
    if (item.currency !== currency) {
      continue;
    }
    const cadence = resolveRecurringSpendFrequency(item);
    if (cadence === 'daily' || cadence === 'weekday') {
      continue;
    }
    const daysUntil = daysUntilRenewal(item, now);
    if (daysUntil > UPCOMING_MONEY_HORIZON_DAYS) {
      continue;
    }
    const title = item.note?.trim() || item.category;
    items.push({
      id: item.id,
      kind: 'subscription',
      title,
      daysUntil,
      href: '/(tabs)/money?segment=subscriptions',
      amount: item.amount,
      currency: item.currency,
      status: upcomingMoneyStatus(daysUntil),
    });
  }

  items.sort(
    (left, right) => left.daysUntil - right.daysUntil || left.title.localeCompare(right.title),
  );
  return items;
}
