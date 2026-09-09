import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CreditCardAccount } from '../reminders/creditCards';
import type { RecurringSpend } from './recurringSpend';
import {
  calculateAnnualBurn,
  calculateMonthlyBurn,
  calculateNextRenewalDate,
  computeSubscriptionsSummary,
  daysUntilRenewal,
} from './subscriptionCockpit';

/**
 * Purpose: minimal RecurringSpend fixture for burn / renewal tests.
 * Inputs: partial overrides (amount + frequency required-ish).
 * Outputs: RecurringSpend.
 * Side effects: none.
 */
function spend(
  partial: Partial<RecurringSpend> & Pick<RecurringSpend, 'id' | 'amount'>,
): RecurringSpend {
  return {
    currency: 'HKD',
    category: 'subscriptions',
    weekdays: [1, 2, 3, 4, 5],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

/**
 * Purpose: minimal CreditCardAccount fixture for allocation mapping.
 * Inputs: id + name overrides.
 * Outputs: CreditCardAccount.
 * Side effects: none.
 */
function card(partial: Partial<CreditCardAccount> & Pick<CreditCardAccount, 'id' | 'name'>): CreditCardAccount {
  return {
    dueDayOfMonth: 25,
    statementDayOfMonth: 5,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('calculateMonthlyBurn / calculateAnnualBurn', () => {
  it('maps daily, weekday, weekly, and monthly frequencies to monthly & annual burn', () => {
    const daily = spend({ id: 'd', amount: 10, frequency: 'daily' });
    // 10 * 365 / 12 = 304.166… → 304.17
    assert.equal(calculateMonthlyBurn(daily), 304.17);
    assert.equal(calculateAnnualBurn(daily), 3650.04);

    const weekday = spend({ id: 'w', amount: 35, frequency: 'weekday' });
    // 35 * 260 / 12 = 758.333… → 758.33
    assert.equal(calculateMonthlyBurn(weekday), 758.33);
    assert.equal(calculateAnnualBurn(weekday), 9099.96);

    const weekly = spend({ id: 'wk', amount: 100, frequency: 'weekly' });
    // 100 * 52 / 12 = 433.333… → 433.33
    assert.equal(calculateMonthlyBurn(weekly), 433.33);
    assert.equal(calculateAnnualBurn(weekly), 5199.96);

    const monthly = spend({ id: 'm', amount: 148, frequency: 'monthly' });
    assert.equal(calculateMonthlyBurn(monthly), 148);
    assert.equal(calculateAnnualBurn(monthly), 1776);
  });

  it('treats missing frequency as weekday (legacy coffee rows)', () => {
    const legacy = spend({ id: 'legacy', amount: 12, weekdays: [1, 2, 3, 4, 5] });
    assert.equal(calculateMonthlyBurn(legacy), Math.round(((12 * 260) / 12) * 100) / 100);
  });
});

describe('calculateNextRenewalDate / daysUntilRenewal', () => {
  it('clamps monthly day 31 onto February and rolls to next month after the target day', () => {
    // 2026-02-10: next 31st clamps to Feb 28.
    const rule = spend({ id: 'netflix', amount: 88, frequency: 'monthly', dayOfMonth: 31 });
    const midFeb = new Date(2026, 1, 10);
    const febRenewal = calculateNextRenewalDate(rule, midFeb);
    assert.equal(febRenewal.getFullYear(), 2026);
    assert.equal(febRenewal.getMonth(), 1);
    assert.equal(febRenewal.getDate(), 28);
    assert.equal(daysUntilRenewal(rule, midFeb), 18);

    // After Feb 28: next is March 31.
    const afterFeb = new Date(2026, 1, 28);
    // On the renewal day itself → today (days = 0).
    assert.equal(daysUntilRenewal(rule, afterFeb), 0);

    const march1 = new Date(2026, 2, 1);
    const marchRenewal = calculateNextRenewalDate(rule, march1);
    assert.equal(marchRenewal.getMonth(), 2);
    assert.equal(marchRenewal.getDate(), 31);
    assert.equal(daysUntilRenewal(rule, march1), 30);
  });

  it('supports start / end month anchors', () => {
    const start = spend({ id: 'rent', amount: 12000, frequency: 'monthly', dayOfMonth: 'start' });
    const end = spend({ id: 'util', amount: 400, frequency: 'monthly', dayOfMonth: 'end' });
    const feb15 = new Date(2026, 1, 15);

    const nextStart = calculateNextRenewalDate(start, feb15);
    assert.equal(nextStart.getMonth(), 2);
    assert.equal(nextStart.getDate(), 1);

    const nextEnd = calculateNextRenewalDate(end, feb15);
    assert.equal(nextEnd.getMonth(), 1);
    assert.equal(nextEnd.getDate(), 28);
  });

  it('finds the next weekly dayOfWeek including today', () => {
    // Wednesday 2026-03-11.
    const wed = new Date(2026, 2, 11);
    assert.equal(wed.getDay(), 3);
    const fridayRule = spend({ id: 'gym', amount: 50, frequency: 'weekly', dayOfWeek: 5 });
    const nextFri = calculateNextRenewalDate(fridayRule, wed);
    assert.equal(nextFri.getDay(), 5);
    assert.equal(nextFri.getDate(), 13);
    assert.equal(daysUntilRenewal(fridayRule, wed), 2);

    const wedRule = spend({ id: 'class', amount: 20, frequency: 'weekly', dayOfWeek: 3 });
    assert.equal(daysUntilRenewal(wedRule, wed), 0);
  });

  it('lands weekday cadence on the next Mon–Fri', () => {
    const friday = new Date(2026, 2, 13); // Fri
    const saturday = new Date(2026, 2, 14); // Sat
    const rule = spend({ id: 'coffee', amount: 35, frequency: 'weekday' });

    assert.equal(daysUntilRenewal(rule, friday), 0);
    const monday = calculateNextRenewalDate(rule, saturday);
    assert.equal(monday.getDay(), 1);
    assert.equal(monday.getDate(), 16);
    assert.equal(daysUntilRenewal(rule, saturday), 2);
  });

  it('treats daily renewal as today', () => {
    const today = new Date(2026, 5, 1);
    const daily = spend({ id: 'vitamin', amount: 5, frequency: 'daily' });
    assert.equal(daysUntilRenewal(daily, today), 0);
    assert.equal(calculateNextRenewalDate(daily, today).getDate(), 1);
  });
});

describe('computeSubscriptionsSummary', () => {
  it('aggregates burn, maps cards, and sorts upcoming renewals within 14 days', () => {
    const cards = [
      card({ id: 'visa', name: 'Visa Gold' }),
      card({ id: 'amex', name: 'Amex' }),
    ];
    const today = new Date(2026, 2, 10); // Tue Mar 10

    const items: RecurringSpend[] = [
      spend({
        id: 'netflix',
        amount: 100,
        frequency: 'monthly',
        dayOfMonth: 12,
        cardId: 'visa',
        note: 'Netflix',
      }),
      spend({
        id: 'spotify',
        amount: 50,
        frequency: 'monthly',
        dayOfMonth: 11,
        cardId: 'amex',
        note: 'Spotify',
      }),
      spend({
        id: 'gym',
        amount: 200,
        frequency: 'monthly',
        dayOfMonth: 1,
        cardId: 'visa',
        category: 'health',
        note: 'Gym',
      }),
      spend({
        id: 'usd-skip',
        amount: 9.99,
        currency: 'USD',
        frequency: 'monthly',
        dayOfMonth: 10,
        cardId: 'visa',
      }),
    ];

    const summary = computeSubscriptionsSummary(items, cards, 'HKD', today);

    assert.equal(summary.activeCount, 3);
    // Spotify 50 + Netflix 100 + Gym 200 = 350 monthly; annual 4200
    assert.equal(summary.totalMonthlyBurn, 350);
    assert.equal(summary.totalAnnualBurn, 4200);

    assert.equal(summary.upcomingRenewals.length, 2);
    assert.equal(summary.upcomingRenewals[0]!.item.id, 'spotify');
    assert.equal(summary.upcomingRenewals[0]!.daysUntilRenewal, 1);
    assert.equal(summary.upcomingRenewals[0]!.cardName, 'Amex');
    assert.equal(summary.upcomingRenewals[1]!.item.id, 'netflix');
    assert.equal(summary.upcomingRenewals[1]!.daysUntilRenewal, 2);

    // Gym renews Apr 1 (22 days) — outside 14-day horizon, omitted from upcoming.
    assert.ok(!summary.upcomingRenewals.some((row) => row.item.id === 'gym'));

    const visa = summary.byCard.find((row) => row.cardId === 'visa');
    assert.ok(visa);
    assert.equal(visa!.cardName, 'Visa Gold');
    assert.equal(visa!.count, 2);
    assert.equal(visa!.monthlyTotal, 300);

    const amex = summary.byCard.find((row) => row.cardId === 'amex');
    assert.ok(amex);
    assert.equal(amex!.count, 1);
    assert.equal(amex!.monthlyTotal, 50);

    const subs = summary.byCategory.find((row) => row.category === 'subscriptions');
    assert.ok(subs);
    assert.equal(subs!.count, 2);
    assert.equal(subs!.monthlyTotal, 150);
  });
});
