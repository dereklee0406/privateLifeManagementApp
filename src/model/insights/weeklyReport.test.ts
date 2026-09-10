import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isoAtLocalNoon } from '../../utils/dateUtils';
import type { Expense } from '../finance/Expense';
import type { JournalEntry } from '../journal/JournalEntry';
import type { Reminder } from '../reminders/Reminder';
import { computeWeeklyInsightsReport } from './weeklyReport';

/**
 * Purpose: journal page on a civil day (local noon).
 * Inputs: id, day key.
 * Outputs: JournalEntry.
 * Side effects: none.
 */
function page(id: string, dayKey: string): JournalEntry {
  const iso = isoAtLocalNoon(dayKey);
  return {
    id,
    createdAt: iso,
    updatedAt: iso,
    kind: 'text',
    title: id,
    body: 'page',
    bodyFormat: 'markdown',
    mood: 'happy',
    tags: [],
    wordCount: 20,
    photoUris: [],
  };
}

/**
 * Purpose: HKD spend row.
 * Inputs: id, amount, day key.
 * Outputs: Expense.
 * Side effects: none.
 */
function spend(id: string, amount: number, dayKey: string): Expense {
  return {
    id,
    amount,
    currency: 'HKD',
    category: 'food',
    dayKey,
    photoUris: [],
    createdAt: isoAtLocalNoon(dayKey),
    updatedAt: isoAtLocalNoon(dayKey),
  };
}

/**
 * Purpose: daily habit with check-ins.
 * Inputs: id, completed keys.
 * Outputs: Reminder.
 * Side effects: none.
 */
function habit(id: string, completedDayKeys: string[]): Reminder {
  return {
    id,
    kind: 'goal',
    title: id,
    hour: 8,
    minute: 0,
    enabled: true,
    recurrence: { type: 'daily' },
    priority: 'normal',
    categoryPath: { top: 'health' },
    anchorAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    completedDayKeys,
  };
}

describe('computeWeeklyInsightsReport', () => {
  // Wednesday 9 Sep 2026 — week so far Mon 7–Wed 9 if week starts Monday.
  const now = new Date(2026, 8, 9, 15);

  it('synthesizes pages, spend, and week-so-far habit hit without listing rows', () => {
    const report = computeWeeklyInsightsReport(
      [page('a', '2026-09-07'), page('b', '2026-09-08'), page('c', '2026-09-01')],
      [spend('s1', 40, '2026-09-08'), spend('s0', 9, '2026-08-31')],
      [habit('run', ['2026-09-07', '2026-09-08', '2026-09-09'])],
      [],
      'HKD',
      now,
      [],
      'monday',
    );
    assert.equal(report.pageCount, 2);
    assert.equal(report.daysWritten, 2);
    assert.equal(report.wordCount, 40);
    assert.equal(report.spendTotal, 40);
    assert.equal(report.activeHabitCount, 1);
    assert.equal(report.habitHitRate, 1);
    assert.equal(report.budgetOverCount, 0);
    assert.equal(report.pressure, 'steady');
  });

  it('marks a silent week quiet and omits habit rate when none exist', () => {
    const report = computeWeeklyInsightsReport([], [], [], [], 'HKD', now, [], 'monday');
    assert.equal(report.pageCount, 0);
    assert.equal(report.spendTotal, 0);
    assert.equal(report.habitHitRate, null);
    assert.equal(report.pressure, 'quiet');
  });
});
