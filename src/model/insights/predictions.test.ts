import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Budget } from '../finance/Budget';
import type { Expense } from '../finance/Expense';
import type { RecurringSpend } from '../finance/recurringSpend';
import type { CreditCardAccount } from '../reminders/creditCards';
import type { Reminder } from '../reminders/Reminder';
import { nextUpCard } from '../today/nextUp';
import { isoAtLocalNoon } from '../../utils/dateUtils';
import { pickTodayPrediction, type TodayPredictionInput } from './predictions';

/**
 * Purpose: overdue once-reminder fixture.
 * Inputs: id, title, civil day key.
 * Outputs: Reminder.
 * Side effects: none.
 */
function onceReminder(id: string, title: string, dayKey: string): Reminder {
  return {
    id,
    kind: 'follow-up',
    title,
    hour: 9,
    minute: 0,
    enabled: true,
    recurrence: { type: 'once', dayKey },
    priority: 'normal',
    categoryPath: { top: 'personal' },
    anchorAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

/**
 * Purpose: credit card fixture for due / overdue predictions.
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
 * Purpose: monthly subscription fixture.
 * Inputs: id, note, day of month, amount.
 * Outputs: RecurringSpend.
 * Side effects: none.
 */
function monthlySub(id: string, note: string, dayOfMonth: number, amount = 88): RecurringSpend {
  return {
    id,
    amount,
    currency: 'HKD',
    category: 'bills',
    note,
    weekdays: [],
    frequency: 'monthly',
    dayOfMonth,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

/**
 * Purpose: HKD spend on a civil day.
 * Inputs: id, amount, day, category.
 * Outputs: Expense.
 * Side effects: none.
 */
function spend(id: string, amount: number, dayKey: string, category: Expense['category'] = 'dining'): Expense {
  return {
    id,
    amount,
    currency: 'HKD',
    category,
    dayKey,
    photoUris: [],
    createdAt: isoAtLocalNoon(dayKey),
    updatedAt: isoAtLocalNoon(dayKey),
  };
}

function diningBudget(limit: number): Budget {
  return {
    id: 'b-dining',
    year: 2026,
    month: 8,
    category: 'dining',
    limit,
    currency: 'HKD',
  };
}

function baseInput(now: Date, partial: Partial<TodayPredictionInput> = {}): TodayPredictionInput {
  const reminders = partial.reminders ?? [];
  const creditCards = partial.creditCards ?? [];
  return {
    reminders,
    creditCards,
    recurringSpends: partial.recurringSpends ?? [],
    expenses: partial.expenses ?? [],
    budgets: partial.budgets ?? [],
    journalDaysWrittenThisWeek: partial.journalDaysWrittenThisWeek ?? 2,
    currency: 'HKD',
    now,
    nextUp: partial.nextUp !== undefined ? partial.nextUp : nextUpCard(reminders, creditCards, 'HKD', now),
  };
}

describe('pickTodayPrediction', () => {
  it('prioritizes an overdue reminder, then a card due within 3 days', () => {
    const wednesday = new Date(2026, 8, 9, 10);
    const overdue = pickTodayPrediction(
      baseInput(wednesday, {
        reminders: [onceReminder('visa-ping', 'Visa bill', '2026-09-01')],
        nextUp: null,
      }),
    );
    assert.equal(overdue?.kind, 'due');
    assert.equal(overdue?.lineKey, 'predictions.overdue');
    assert.equal(overdue?.lineParams?.title, 'Visa bill');
    assert.equal(overdue?.href, '/reminders/visa-ping');

    const todayHabit = onceReminder('gym', 'Gym', '2026-09-09');
    const cardDue = pickTodayPrediction(
      baseInput(wednesday, {
        reminders: [todayHabit],
        creditCards: [card('hsbc', 'HSBC Red', 12)],
      }),
    );
    assert.equal(cardDue?.kind, 'due');
    assert.equal(cardDue?.lineKey, 'predictions.cardDue');
    assert.equal(cardDue?.lineParams?.days, 3);
    assert.equal(cardDue?.sourceId, 'hsbc');
  });

  it('skips the Next Up hero and demotes to a sub renewal within 7 days', () => {
    const wednesday = new Date(2026, 8, 9, 10);
    const reminders = [onceReminder('visa-ping', 'Visa bill', '2026-09-01')];
    const recurringSpends = [monthlySub('netflix', 'Netflix', 12)];
    const nextUp = nextUpCard(reminders, [], 'HKD', wednesday);
    assert.equal(nextUp?.id, 'visa-ping');
    const prediction = pickTodayPrediction(
      baseInput(wednesday, { reminders, recurringSpends, nextUp }),
    );
    assert.equal(prediction?.kind, 'renewal');
    assert.equal(prediction?.lineKey, 'predictions.renewal');
    assert.equal(prediction?.lineParams?.title, 'Netflix');
    assert.equal(prediction?.lineParams?.days, 3);
  });

  it('picks envelope pace when dining is ahead of the calendar (70% with 18 days left)', () => {
    const saturday = new Date(2026, 8, 12, 10);
    const prediction = pickTodayPrediction(
      baseInput(saturday, {
        budgets: [diningBudget(100)],
        expenses: [spend('d1', 70, '2026-09-05')],
        journalDaysWrittenThisWeek: 2,
      }),
    );
    assert.equal(prediction?.kind, 'pace');
    assert.equal(prediction?.lineKey, 'predictions.pace');
    assert.equal(prediction?.lineParams?.percent, 70);
    assert.equal(prediction?.lineParams?.category, 'dining');
    assert.equal(prediction?.lineParams?.days, 18);
  });

  it('does not flag pace when spend matches the calendar, and skips daily coffee as a renewal', () => {
    const saturday = new Date(2026, 8, 12, 10);
    const coffee: RecurringSpend = {
      id: 'coffee',
      amount: 12,
      currency: 'HKD',
      category: 'dining',
      note: 'Coffee',
      weekdays: [1, 2, 3, 4, 5],
      frequency: 'daily',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const onPace = pickTodayPrediction(
      baseInput(saturday, {
        budgets: [diningBudget(100)],
        expenses: [spend('d1', 40, '2026-09-05')],
        recurringSpends: [coffee],
        journalDaysWrittenThisWeek: 2,
      }),
    );
    assert.equal(onPace, null);
  });

  it('surfaces writing quiet on Thursday–Sunday when the week has no pages', () => {
    const thursday = new Date(2026, 8, 10, 10);
    const monday = new Date(2026, 8, 7, 10);
    const quiet = pickTodayPrediction(
      baseInput(thursday, { journalDaysWrittenThisWeek: 0 }),
    );
    assert.equal(quiet?.kind, 'writing');
    assert.equal(quiet?.lineKey, 'predictions.writing');
    assert.equal(quiet?.href, '/compose?mode=text');
    assert.equal(pickTodayPrediction(baseInput(monday, { journalDaysWrittenThisWeek: 0 })), null);
    assert.equal(pickTodayPrediction(baseInput(thursday, { journalDaysWrittenThisWeek: 1 })), null);
  });

  it('returns at most one prediction and prefers due over writing', () => {
    const thursday = new Date(2026, 8, 10, 10);
    const prediction = pickTodayPrediction(
      baseInput(thursday, {
        reminders: [onceReminder('late', 'Form', '2026-09-01')],
        journalDaysWrittenThisWeek: 0,
        nextUp: null,
      }),
    );
    assert.equal(prediction?.kind, 'due');
  });
});
