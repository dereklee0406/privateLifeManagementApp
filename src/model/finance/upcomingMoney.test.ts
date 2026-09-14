import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CreditCardAccount } from '../reminders/creditCards';
import type { RecurringSpend } from './recurringSpend';
import { listUpcomingMoney, upcomingMoneyStatus, UPCOMING_MONEY_HORIZON_DAYS } from './upcomingMoney';

/**
 * Purpose: card fixture for Upcoming sort / overdue tests.
 * Inputs: id, name, due day, optional amount due.
 * Outputs: CreditCardAccount.
 * Side effects: none.
 */
function card(
  id: string,
  name: string,
  dueDayOfMonth: number,
  amountDue?: number,
): CreditCardAccount {
  return {
    id,
    name,
    dueDayOfMonth,
    statementDayOfMonth: 1,
    amountDue,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

/**
 * Purpose: recurring spend fixture.
 * Inputs: id, note, frequency, day of month, amount, currency.
 * Outputs: RecurringSpend.
 * Side effects: none.
 */
function sub(
  id: string,
  note: string,
  dayOfMonth: number,
  amount = 88,
  currency: RecurringSpend['currency'] = 'HKD',
  frequency: RecurringSpend['frequency'] = 'monthly',
): RecurringSpend {
  return {
    id,
    amount,
    currency,
    category: 'bills',
    note,
    weekdays: [],
    frequency,
    dayOfMonth,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('upcomingMoneyStatus', () => {
  it('maps overdue / today / soon / later', () => {
    assert.equal(upcomingMoneyStatus(-2), 'overdue');
    assert.equal(upcomingMoneyStatus(0), 'today');
    assert.equal(upcomingMoneyStatus(7), 'soon');
    assert.equal(upcomingMoneyStatus(8), 'later');
  });
});

describe('listUpcomingMoney', () => {
  const now = new Date(2026, 8, 10, 12);

  it('returns empty when nothing is due in the horizon', () => {
    assert.deepEqual(listUpcomingMoney([], [], 'HKD', now), []);
  });

  it('includes overdue unpaid cards first, then soon subs, and skips daily coffee', () => {
    const visa = card('visa', 'Visa', 5, 1200);
    const far = card('far', 'Far', 28);
    const netflix = sub('netflix', 'Netflix', 12);
    const coffee = sub('coffee', 'Coffee', 10, 35, 'HKD', 'daily');
    const usdSub = sub('usd', 'Adobe', 11, 20, 'USD');
    const rows = listUpcomingMoney([visa, far], [netflix, coffee, usdSub], 'HKD', now);
    assert.equal(rows[0]?.id, 'visa');
    assert.equal(rows[0]?.kind, 'card');
    assert.equal(rows[0]?.status, 'overdue');
    assert.ok(rows[0]!.daysUntil < 0);
    assert.ok(rows.some((row) => row.id === 'netflix' && row.kind === 'subscription'));
    assert.ok(!rows.some((row) => row.id === 'coffee'));
    assert.ok(!rows.some((row) => row.id === 'usd'));
    assert.ok(!rows.some((row) => row.id === 'far') || (rows.find((row) => row.id === 'far')!.daysUntil <= UPCOMING_MONEY_HORIZON_DAYS));
  });

  it('keeps a card due today inside Upcoming', () => {
    const dueToday = card('amex', 'Amex', 10, 50);
    const rows = listUpcomingMoney([dueToday], [], 'HKD', now);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.status, 'today');
    assert.equal(rows[0]?.href, '/reminders/card/amex');
  });
});
