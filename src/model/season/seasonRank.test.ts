import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isoAtLocalNoon } from '../../utils/dateUtils';
import type { Budget, BudgetProgress } from '../finance/Budget';
import type { Expense } from '../finance/Expense';
import type { JournalEntry } from '../journal/JournalEntry';
import type { Reminder } from '../reminders/Reminder';
import {
  budgetDisciplineScore,
  compositeSeasonScore,
  computeSeasonRank,
  presentSeasonPillars,
  rankFromScore,
  SEASON_RANK_TABLE,
  SEASON_WINDOW_DAYS,
} from './seasonRank';

/**
 * Purpose: local-noon journal page for Season window tests.
 * Inputs: id, civil day key, optional word count.
 * Outputs: JournalEntry.
 * Side effects: none.
 */
function page(id: string, dayKey: string, wordCount = 12): JournalEntry {
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
 * Purpose: daily habit fixture with optional check-ins.
 * Inputs: id, completed day keys.
 * Outputs: Reminder.
 * Side effects: none.
 */
function habit(id: string, completedDayKeys: string[] = []): Reminder {
  return {
    id,
    kind: 'goal',
    title: id,
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

/**
 * Purpose: YYYY-MM-DD keys walking backward from `endKey` (inclusive).
 * Inputs: last day, count.
 * Outputs: oldest → newest keys.
 * Side effects: none.
 */
function trailingKeys(endKey: string, count: number): string[] {
  const [year, month, day] = endKey.split('-').map(Number);
  const keys: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(year, (month ?? 1) - 1, (day ?? 1) - offset);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    keys.push(key);
  }
  return keys;
}

function envelope(
  spent: number,
  limit: number,
  over = spent > limit,
): BudgetProgress {
  const budget: Budget = {
    id: 'b',
    year: 2026,
    month: 8,
    category: 'food',
    limit,
    currency: 'HKD',
  };
  return { budget, spent, remaining: limit - spent, over };
}

describe('rankFromScore / SEASON_RANK_TABLE', () => {
  it('maps Spark → Ember → Forge → Temper → Steel on inclusive floors', () => {
    assert.equal(rankFromScore(0), 'spark');
    assert.equal(rankFromScore(0.199), 'spark');
    assert.equal(rankFromScore(0.2), 'ember');
    assert.equal(rankFromScore(0.399), 'ember');
    assert.equal(rankFromScore(0.4), 'forge');
    assert.equal(rankFromScore(0.649), 'forge');
    assert.equal(rankFromScore(0.65), 'temper');
    assert.equal(rankFromScore(0.849), 'temper');
    assert.equal(rankFromScore(0.85), 'steel');
    assert.equal(rankFromScore(1), 'steel');
    assert.equal(rankFromScore(Number.NaN), 'spark');
    assert.deepEqual(
      SEASON_RANK_TABLE.map((row) => row.id),
      ['steel', 'temper', 'forge', 'ember', 'spark'],
    );
  });
});

describe('budgetDisciplineScore', () => {
  it('omits the pillar when there are no envelopes', () => {
    assert.equal(budgetDisciplineScore([]), null);
  });

  it('scores unused envelopes 1, full-but-not-over 0.55, and overspent 0', () => {
    assert.equal(budgetDisciplineScore([envelope(0, 1000)]), 1);
    assert.equal(budgetDisciplineScore([envelope(1000, 1000, false)]), 0.55);
    assert.equal(budgetDisciplineScore([envelope(1200, 1000, true)]), 0);
    const mixed = budgetDisciplineScore([envelope(0, 1000), envelope(2000, 1000, true)]);
    assert.equal(mixed, 0.5);
  });
});

describe('compositeSeasonScore', () => {
  it('averages present pillars and ignores null habit / budget', () => {
    assert.equal(compositeSeasonScore(0.5, null, null), 0.5);
    assert.equal(compositeSeasonScore(1, 1, 1), 1);
    assert.equal(compositeSeasonScore(0, 0, 0), 0);
    assert.equal(compositeSeasonScore(1, 0, null), 0.5);
  });
});

describe('presentSeasonPillars', () => {
  it('always includes writing and omits missing habit / budget pillars', () => {
    const writingOnly = presentSeasonPillars({
      writingRate: 0.4,
      habitHitRate: null,
      budgetDiscipline: null,
    });
    assert.deepEqual(
      writingOnly.map((pillar) => pillar.id),
      ['writing'],
    );
    assert.equal(writingOnly[0]?.rate, 0.4);

    const all = presentSeasonPillars({
      writingRate: 1,
      habitHitRate: 0.5,
      budgetDiscipline: 0.55,
    });
    assert.deepEqual(
      all.map((pillar) => pillar.id),
      ['writing', 'habits', 'budget'],
    );
  });
});

function monthBudget(limit: number): Budget {
  return {
    id: 'food',
    year: 2026,
    month: 8,
    category: 'food',
    limit,
    currency: 'HKD',
  };
}

function monthSpend(amount: number, dayKey = '2026-09-05'): Expense {
  return {
    id: `e-${dayKey}`,
    amount,
    currency: 'HKD',
    category: 'food',
    dayKey,
    photoUris: [],
    createdAt: isoAtLocalNoon(dayKey),
    updatedAt: isoAtLocalNoon(dayKey),
  };
}

describe('computeSeasonRank', () => {
  const now = new Date(2026, 8, 10, 12);

  it('is Spark with no pages, habits, or budgets', () => {
    const season = computeSeasonRank([], [], [], [], 'HKD', now);
    assert.equal(season.rank, 'spark');
    assert.equal(season.writingDays30, 0);
    assert.equal(season.writingRate, 0);
    assert.equal(season.habitHitRate, null);
    assert.equal(season.budgetDiscipline, null);
    assert.equal(season.windowDays, SEASON_WINDOW_DAYS);
  });

  it('counts 30-day writing days and ignores the 31st day back', () => {
    const today = '2026-09-10';
    const keys = trailingKeys(today, 31);
    const entries = keys.map((key, index) => page(`p${index}`, key));
    const season = computeSeasonRank(entries, [], [], [], 'HKD', now);
    assert.equal(season.writingDays30, 30);
    assert.equal(season.writingRate, 1);
    assert.equal(season.rank, 'steel');
  });

  it('lands on Forge from half writing days with no other pillars', () => {
    const keys = trailingKeys('2026-09-10', 15);
    const entries = keys.map((key, index) => page(`p${index}`, key));
    const season = computeSeasonRank(entries, [], [], [], 'HKD', now);
    assert.equal(season.writingDays30, 15);
    assert.equal(season.rank, 'forge');
  });

  it('blends writing, 30-day habit hit, and budget discipline equally', () => {
    const writeKeys = trailingKeys('2026-09-10', 30);
    const entries = writeKeys.map((key, index) => page(`p${index}`, key));
    const run = habit('run', writeKeys);
    const season = computeSeasonRank(entries, [run], [monthBudget(800)], [], 'HKD', now);
    assert.equal(season.habitHitRate, 1);
    assert.equal(season.budgetDiscipline, 1);
    assert.equal(season.score, 1);
    assert.equal(season.rank, 'steel');
    assert.equal(season.bestCurrentStreak, 30);
  });

  it('drops an overspent envelope to Spark when writing and habits are empty', () => {
    const season = computeSeasonRank([], [], [monthBudget(100)], [monthSpend(500)], 'HKD', now);
    assert.equal(season.budgetDiscipline, 0);
    assert.equal(season.rank, 'spark');
    assert.equal(season.score, 0);
  });
});
