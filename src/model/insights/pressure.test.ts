import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pickMonthlyPressure, pickWeeklyPressure } from './pressure';

describe('pickWeeklyPressure', () => {
  const quiet = {
    daysWritten: 0,
    pageCount: 0,
    spendTotal: 0,
    remindersCompleted: 0,
    remindersOverdue: 0,
    habitHitRate: null as number | null,
    budgetOverCount: 0,
  };

  it('prioritizes overdue, then envelopes, then thin habits, then quiet', () => {
    assert.equal(pickWeeklyPressure({ ...quiet, remindersOverdue: 2 }), 'overdue');
    assert.equal(pickWeeklyPressure({ ...quiet, pageCount: 2, daysWritten: 2, budgetOverCount: 1 }), 'budget');
    assert.equal(
      pickWeeklyPressure({ ...quiet, pageCount: 2, daysWritten: 2, spendTotal: 40, habitHitRate: 0.2 }),
      'habits',
    );
    assert.equal(pickWeeklyPressure(quiet), 'quiet');
  });

  it('flags a week with spend but no pages as writing, and a full loop as steady', () => {
    assert.equal(pickWeeklyPressure({ ...quiet, spendTotal: 80 }), 'writing');
    assert.equal(
      pickWeeklyPressure({
        daysWritten: 3,
        pageCount: 4,
        spendTotal: 120,
        remindersCompleted: 2,
        remindersOverdue: 0,
        habitHitRate: 0.8,
        budgetOverCount: 0,
      }),
      'steady',
    );
  });
});

describe('pickMonthlyPressure', () => {
  const base = {
    dayOfMonth: 12,
    writingDays: 8,
    pageCount: 8,
    spent: 400,
    spendPercentChange: 5 as number | null,
    habitHitRate: 0.7 as number | null,
    budgetOverCount: 0,
    netWorthDelta: 200 as number | undefined,
  };

  it('prioritizes overspent envelopes and a 20% spend jump', () => {
    assert.equal(pickMonthlyPressure({ ...base, budgetOverCount: 1 }), 'budget');
    assert.equal(pickMonthlyPressure({ ...base, spendPercentChange: 20 }), 'spendUp');
    assert.equal(pickMonthlyPressure({ ...base, spendPercentChange: 19 }), 'steady');
  });

  it('does not scold thin writing before the 10th unless there are zero pages', () => {
    assert.equal(
      pickMonthlyPressure({ ...base, dayOfMonth: 4, writingDays: 1, pageCount: 1, spent: 10 }),
      'steady',
    );
    assert.equal(
      pickMonthlyPressure({ ...base, dayOfMonth: 4, writingDays: 0, pageCount: 0, spent: 10 }),
      'writing',
    );
    assert.equal(
      pickMonthlyPressure({ ...base, dayOfMonth: 12, writingDays: 2, pageCount: 2 }),
      'writing',
    );
  });

  it('falls through to habits, worth slip, quiet, then steady', () => {
    assert.equal(pickMonthlyPressure({ ...base, habitHitRate: 0.1 }), 'habits');
    assert.equal(pickMonthlyPressure({ ...base, netWorthDelta: -50 }), 'worth');
    assert.equal(
      pickMonthlyPressure({
        ...base,
        writingDays: 4,
        pageCount: 0,
        spent: 0,
        spendPercentChange: null,
        habitHitRate: null,
        netWorthDelta: undefined,
      }),
      'quiet',
    );
    assert.equal(pickMonthlyPressure(base), 'steady');
  });
});
