import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isoAtLocalNoon } from '../../utils/dateUtils';
import type { Expense } from '../finance/Expense';
import type { JournalEntry } from '../journal/JournalEntry';
import type { Reminder } from '../reminders/Reminder';
import {
  alignedPreviousMonthSoFar,
  compareBarRatios,
  comparePeriod,
  compareRates,
  computeMonthlyBoardFacts,
  computeWeeklyBoardFacts,
  monthWritingBars,
  monthWritingPace,
  moodClimateSegments,
  pageCountBetween,
  weekActivityStrip,
  writingDaysBetween,
} from './boardFacts';
import { computeMonthlyInsightsReport } from './monthlyReport';
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

describe('comparePeriod / compareRates', () => {
  it('hides relative percent when there is no previous baseline', () => {
    const delta = comparePeriod(2, 0, false);
    assert.equal(delta.delta, 2);
    assert.equal(delta.percent, null);
    assert.equal(delta.hasPrevious, false);
  });

  it('rounds relative percent when previous is non-zero', () => {
    const delta = comparePeriod(150, 100, true);
    assert.equal(delta.delta, 50);
    assert.equal(delta.percent, 50);
  });

  it('omits habit rates when the current domain is missing', () => {
    assert.equal(compareRates(null, 0.5), null);
  });

  it('stores habit comparison as points, not percent-of-percent', () => {
    const delta = compareRates(0.8, 0.5);
    assert.ok(delta);
    assert.equal(delta.current, 80);
    assert.equal(delta.previous, 50);
    assert.equal(delta.delta, 30);
    assert.equal(delta.percent, null);
    assert.equal(delta.hasPrevious, true);
  });
});

describe('pageCountBetween / writingDaysBetween / alignedPreviousMonthSoFar', () => {
  it('counts pages and distinct days in a closed window', () => {
    const entries = [page('a', '2026-09-07'), page('b', '2026-09-07'), page('c', '2026-09-08'), page('out', '2026-09-01')];
    assert.equal(pageCountBetween(entries, '2026-09-07', '2026-09-08'), 3);
    assert.equal(writingDaysBetween(entries, '2026-09-07', '2026-09-08'), 2);
  });

  it('clamps 31 Jan onto February’s last day', () => {
    const range = alignedPreviousMonthSoFar(new Date(2026, 2, 31, 12));
    assert.equal(range.startKey, '2026-02-01');
    assert.equal(range.endKey, '2026-02-28');
  });
});

describe('weekActivityStrip / monthWritingPace', () => {
  const now = new Date(2026, 8, 9, 15); // Wed 9 Sep 2026

  it('fills seven cells, marks today, and leaves Thursday–Sunday future', () => {
    const strip = weekActivityStrip(
      [page('a', '2026-09-07'), page('b', '2026-09-09')],
      [habit('run', ['2026-09-07', '2026-09-08'])],
      now,
      'monday',
    );
    assert.equal(strip.length, 7);
    assert.equal(strip[0]?.dayKey, '2026-09-07');
    assert.equal(strip[0]?.wrote, true);
    assert.equal(strip[0]?.habitHit, true);
    assert.equal(strip[2]?.isToday, true);
    assert.equal(strip[3]?.isFuture, true);
    assert.equal(strip[3]?.wrote, false);
  });

  it('paces writing days against elapsed days this month', () => {
    const pace = monthWritingPace(6, new Date(2026, 8, 12, 10));
    assert.equal(pace.elapsedDays, 12);
    assert.equal(pace.daysInMonth, 30);
    assert.equal(pace.ratio, 0.5);
  });
});

describe('compareBarRatios / monthWritingBars / moodClimate', () => {
  it('scales this vs last to the larger amount and keeps zeros at 0', () => {
    const even = compareBarRatios(80, 40, true);
    assert.equal(even.currentRatio, 1);
    assert.equal(even.previousRatio, 0.5);
    const empty = compareBarRatios(0, 0, false);
    assert.equal(empty.currentRatio, 0);
    assert.equal(empty.previousRatio, 0);
    assert.equal(empty.hasPrevious, false);
    const first = compareBarRatios(50, 0, false);
    assert.equal(first.currentRatio, 1);
    assert.equal(first.previousRatio, 0);
    const down = compareBarRatios(0, 100, true);
    assert.equal(down.currentRatio, 0);
    assert.equal(down.previousRatio, 1);
  });

  it('builds one bar per civil day in September and leaves future empty', () => {
    const now = new Date(2026, 8, 12, 10);
    const bars = monthWritingBars([page('a', '2026-09-02'), page('b', '2026-09-02'), page('c', '2026-09-11')], now);
    assert.equal(bars.length, 30);
    assert.equal(bars[0]?.dayKey, '2026-09-01');
    assert.equal(bars[0]?.wrote, false);
    assert.equal(bars[1]?.wrote, true);
    assert.equal(bars[11]?.isToday, true);
    assert.equal(bars[12]?.isFuture, true);
    assert.equal(bars[12]?.wrote, false);
  });

  it('shares this-week mix as Good / Steady / Off / Rough without English labels', () => {
    const entries = [
      page('h1', '2026-09-07'),
      page('h2', '2026-09-08'),
      { ...page('s1', '2026-09-09'), mood: 'sad' as const },
      { ...page('a1', '2026-09-09'), mood: 'angry' as const },
    ];
    const segments = moodClimateSegments(entries, '2026-09-07', '2026-09-09');
    assert.equal(segments.length, 4);
    assert.equal(segments[0]?.climate, 'happy');
    assert.equal(segments[0]?.count, 2);
    assert.ok(Math.abs((segments[0]?.share ?? 0) - 0.5) < 1e-9);
    assert.equal(segments[2]?.climate, 'sad');
    assert.equal(segments[2]?.count, 1);
    assert.equal(segments[3]?.climate, 'angry');
    assert.equal(segments[3]?.count, 1);
    const empty = moodClimateSegments([], '2026-09-07', '2026-09-09');
    assert.deepEqual(
      empty.map((row) => row.count),
      [0, 0, 0, 0],
    );
  });
});

describe('computeWeeklyBoardFacts', () => {
  const now = new Date(2026, 8, 9, 15);

  it('compares Mon–Wed to last Mon–Wed and flags a quiet week sparse', () => {
    const entries = [page('a', '2026-09-07'), page('b', '2026-09-08'), page('old', '2026-08-31')];
    const expenses = [spend('s1', 40, '2026-09-08'), spend('s0', 10, '2026-08-31')];
    const reminders = [habit('run', ['2026-09-07', '2026-09-08', '2026-09-09', '2026-08-31'])];
    const report = computeWeeklyInsightsReport(entries, expenses, reminders, [], 'HKD', now, [], 'monday');
    const board = computeWeeklyBoardFacts(report, entries, expenses, reminders, now, 'monday');
    const pages = board.tiles.find((tile) => tile.id === 'pages');
    const spendTile = board.tiles.find((tile) => tile.id === 'spend');
    const habits = board.tiles.find((tile) => tile.id === 'habits');
    assert.equal(pages?.value, 2);
    assert.equal(pages?.delta?.previous, 1);
    assert.equal(pages?.delta?.delta, 1);
    assert.equal(spendTile?.value, 40);
    assert.equal(spendTile?.delta?.previous, 10);
    assert.equal(habits?.value, 100);
    assert.equal(board.sparse, false);
    assert.equal(board.strip.length, 7);
    assert.equal(board.spendCompare.current, 40);
    assert.equal(board.spendCompare.previous, 10);
    assert.equal(board.habitMeter.rate, 1);
    assert.equal(board.moodClimate[0]?.count, 2);

    const empty = computeWeeklyInsightsReport([], [], [], [], 'HKD', now, [], 'monday');
    const emptyBoard = computeWeeklyBoardFacts(empty, [], [], [], now, 'monday');
    assert.equal(emptyBoard.sparse, true);
    assert.equal(emptyBoard.tiles.find((tile) => tile.id === 'habits')?.value, null);
    assert.equal(emptyBoard.habitMeter.rate, null);
    assert.equal(emptyBoard.moodClimate.every((row) => row.count === 0), true);
  });
});

describe('computeMonthlyBoardFacts', () => {
  const now = new Date(2026, 8, 12, 10);

  it('builds five tiles, a 30-bar writing series, and a Worth sparkline', () => {
    const entries = [page('sep-a', '2026-09-02'), page('sep-b', '2026-09-11'), page('aug', '2026-08-05')];
    const expenses = [spend('s1', 100, '2026-09-03'), spend('prev', 100, '2026-08-15')];
    const reminders = [habit('run', ['2026-09-01', '2026-09-02', '2026-08-01', '2026-08-02'])];
    const history = [
      {
        monthKey: '2026-08',
        currency: 'HKD' as const,
        assets: 1000,
        loans: 0,
        cardDebt: 0,
        net: 1000,
        capturedAt: '2026-08-15T00:00:00.000Z',
      },
      {
        monthKey: '2026-09',
        currency: 'HKD' as const,
        assets: 1500,
        loans: 0,
        cardDebt: 0,
        net: 1500,
        capturedAt: '2026-09-12T00:00:00.000Z',
      },
    ];
    const report = computeMonthlyInsightsReport(entries, expenses, reminders, [], history, 'HKD', now);
    const board = computeMonthlyBoardFacts(report, entries, reminders, now, history);
    assert.equal(board.tiles.length, 5);
    assert.equal(board.tiles.find((tile) => tile.id === 'pages')?.value, 2);
    assert.equal(board.tiles.find((tile) => tile.id === 'pages')?.delta?.previous, 1);
    assert.equal(board.tiles.find((tile) => tile.id === 'worth')?.value, 500);
    assert.equal(board.pace.writingDays, 2);
    assert.equal(board.pace.elapsedDays, 12);
    assert.equal(board.writingBars.length, 30);
    assert.equal(board.worthSpark.length, 2);
    assert.equal(board.spendCompare.hasPrevious, true);
    assert.equal(board.habitMeter.rate !== null, true);
    assert.equal(board.moodClimate.some((row) => row.count > 0), true);
    assert.equal(board.sparse, false);
  });

  it('flags a silent month sparse', () => {
    const report = computeMonthlyInsightsReport([], [], [], [], [], 'HKD', now);
    const board = computeMonthlyBoardFacts(report, [], [], now);
    assert.equal(board.sparse, true);
    assert.equal(board.tiles.find((tile) => tile.id === 'habits')?.value, null);
    assert.equal(board.writingBars.length, 30);
    assert.equal(board.worthSpark.length, 0);
    assert.equal(board.habitMeter.rate, null);
  });
});
