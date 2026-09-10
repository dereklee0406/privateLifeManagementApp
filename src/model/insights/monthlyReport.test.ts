import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isoAtLocalNoon } from '../../utils/dateUtils';
import type { Budget } from '../finance/Budget';
import type { Expense } from '../finance/Expense';
import type { NetWorthHistoryRow } from '../finance/netWorthHistory';
import type { JournalEntry } from '../journal/JournalEntry';
import type { Reminder } from '../reminders/Reminder';
import { computeMonthlyInsightsReport } from './monthlyReport';

/**
 * Purpose: journal page on a civil day.
 * Inputs: id, day key, optional words.
 * Outputs: JournalEntry.
 * Side effects: none.
 */
function page(id: string, dayKey: string, wordCount = 10): JournalEntry {
  const iso = isoAtLocalNoon(dayKey);
  return {
    id,
    createdAt: iso,
    updatedAt: iso,
    kind: 'text',
    title: id,
    body: 'page',
    bodyFormat: 'markdown',
    mood: 'neutral',
    tags: [],
    wordCount,
    photoUris: [],
  };
}

/**
 * Purpose: HKD spend in a category.
 * Inputs: id, amount, day, optional category.
 * Outputs: Expense.
 * Side effects: none.
 */
function spend(
  id: string,
  amount: number,
  dayKey: string,
  category: Expense['category'] = 'food',
): Expense {
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

function budget(limit: number, category: Budget['category'] = 'food'): Budget {
  return {
    id: `b-${category}`,
    year: 2026,
    month: 8,
    category,
    limit,
    currency: 'HKD',
  };
}

function habit(completedDayKeys: string[]): Reminder {
  return {
    id: 'run',
    kind: 'goal',
    title: 'Run',
    hour: 7,
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

function snap(monthKey: string, net: number): NetWorthHistoryRow {
  return {
    monthKey,
    currency: 'HKD',
    assets: net + 100,
    loans: 100,
    cardDebt: 0,
    net,
    capturedAt: `${monthKey}-15T00:00:00.000Z`,
  };
}

describe('computeMonthlyInsightsReport', () => {
  const now = new Date(2026, 8, 12, 10);

  it('counts this month’s pages, spend vs last month, habit hit, and snapshot delta', () => {
    const report = computeMonthlyInsightsReport(
      [page('sep-a', '2026-09-02'), page('sep-b', '2026-09-11'), page('aug', '2026-08-20')],
      [
        spend('s1', 100, '2026-09-03'),
        spend('s2', 50, '2026-09-10'),
        spend('prev', 100, '2026-08-15'),
      ],
      [habit(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06'])],
      [],
      [snap('2026-09', 12_000), snap('2026-08', 10_000)],
      'HKD',
      now,
    );
    assert.equal(report.pageCount, 2);
    assert.equal(report.writingDays, 2);
    assert.equal(report.wordCount, 20);
    assert.equal(report.spent, 150);
    assert.equal(report.previousSpent, 100);
    assert.equal(report.hasPreviousSpend, true);
    assert.equal(report.spendPercentChange, 50);
    assert.equal(report.netWorthDelta, 2000);
    assert.equal(report.hasNetWorthSnapshot, true);
    assert.equal(report.pressure, 'spendUp');
    assert.ok(report.habitHitRate !== null);
    assert.ok((report.habitHitRate ?? 0) > 0.4 && (report.habitHitRate ?? 1) < 0.6);
  });

  it('flags an overspent envelope ahead of spend-up, and omits net-worth without a snapshot', () => {
    const report = computeMonthlyInsightsReport(
      [page('a', '2026-09-01'), page('b', '2026-09-02'), page('c', '2026-09-03')],
      [spend('food', 400, '2026-09-04'), spend('last', 100, '2026-08-02')],
      [],
      [budget(200, 'food')],
      [],
      'HKD',
      now,
    );
    assert.equal(report.budgetOverCount, 1);
    assert.equal(report.budgetCount, 1);
    assert.equal(report.hasNetWorthSnapshot, false);
    assert.equal(report.netWorthDelta, undefined);
    assert.equal(report.habitHitRate, null);
    assert.equal(report.pressure, 'budget');
  });

  it('flags a silent mid-month as writing when there is nothing to compare', () => {
    const report = computeMonthlyInsightsReport([], [], [], [], [], 'HKD', now);
    assert.equal(report.pageCount, 0);
    assert.equal(report.spent, 0);
    assert.equal(report.hasPreviousSpend, false);
    assert.equal(report.pressure, 'writing');
  });
});
