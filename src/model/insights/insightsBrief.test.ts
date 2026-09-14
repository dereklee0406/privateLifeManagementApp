import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { InsightsGlanceTile, MonthlyBoardFacts, WeeklyBoardFacts } from './boardFacts';
import { buildMonthlyInsightsBrief, buildWeeklyInsightsBrief } from './insightsBrief';
import type { MonthlyInsightsReport } from './monthlyReport';
import type { WeeklyInsightsReport } from './weeklyReport';

/**
 * Purpose: glance tile fixture for brief win/risk tests.
 * Inputs: partial tile.
 * Outputs: InsightsGlanceTile.
 * Side effects: none.
 */
function tile(partial: Partial<InsightsGlanceTile> & Pick<InsightsGlanceTile, 'id'>): InsightsGlanceTile {
  return {
    value: 0,
    unit: 'count',
    delta: null,
    flavor: 'moreIsGood',
    ...partial,
  };
}

function weeklyReport(partial: Partial<WeeklyInsightsReport> = {}): WeeklyInsightsReport {
  return {
    daysWritten: 0,
    pageCount: 0,
    wordCount: 0,
    spendTotal: 0,
    currency: 'HKD',
    remindersCompleted: 0,
    remindersRemaining: 0,
    remindersOverdue: 0,
    habitHitRate: null,
    activeHabitCount: 0,
    budgetOverCount: 0,
    pressure: 'quiet',
    ...partial,
  };
}

function weeklyBoard(tiles: InsightsGlanceTile[] = []): WeeklyBoardFacts {
  return { tiles, strip: [], sparse: tiles.length === 0 };
}

function monthlyReport(partial: Partial<MonthlyInsightsReport> = {}): MonthlyInsightsReport {
  return {
    pageCount: 0,
    writingDays: 0,
    wordCount: 0,
    habitHitRate: null,
    activeHabitCount: 0,
    spent: 0,
    previousSpent: 0,
    spendPercentChange: null,
    hasPreviousSpend: false,
    currency: 'HKD',
    budgetOverCount: 0,
    budgetCount: 0,
    netWorthDelta: undefined,
    hasNetWorthSnapshot: false,
    pressure: 'quiet',
    ...partial,
  };
}

function monthlyBoard(tiles: InsightsGlanceTile[] = []): MonthlyBoardFacts {
  return { tiles, pace: { writingDays: 0, elapsedDays: 1, daysInMonth: 30, ratio: 0 }, sparse: true };
}

describe('buildWeeklyInsightsBrief', () => {
  it('omits wins and risks on an empty quiet week', () => {
    const brief = buildWeeklyInsightsBrief(weeklyReport(), weeklyBoard());
    assert.equal(brief.pressure, 'quiet');
    assert.deepEqual(brief.wins, []);
    assert.deepEqual(brief.risks, []);
    assert.equal(brief.actionHref, '/(tabs)/journal');
  });

  it('lists overdue and thin habits as risks, writing-day lift as a win', () => {
    const brief = buildWeeklyInsightsBrief(
      weeklyReport({
        daysWritten: 4,
        remindersOverdue: 2,
        habitHitRate: 0.2,
        pressure: 'overdue',
      }),
      weeklyBoard([
        tile({
          id: 'writingDays',
          value: 4,
          delta: { current: 4, previous: 1, delta: 3, percent: null, hasPrevious: true },
        }),
        tile({ id: 'habits', value: 20, unit: 'percent' }),
      ]),
    );
    assert.deepEqual(
      brief.wins.map((row) => row.id),
      ['writingDays'],
    );
    assert.equal(brief.wins[0]?.value, 3);
    assert.ok(brief.risks.some((row) => row.id === 'overdue' && row.value === 2));
    assert.ok(brief.risks.some((row) => row.id === 'habitThin' && row.value === 20));
    assert.equal(brief.actionHref, '/(tabs)/calendar?tab=tasks');
  });

  it('treats a spend drop as a win and a ≥20% jump as a risk', () => {
    const down = buildWeeklyInsightsBrief(
      weeklyReport({ pressure: 'steady' }),
      weeklyBoard([
        tile({
          id: 'spend',
          unit: 'money',
          flavor: 'moreIsBad',
          value: 80,
          currency: 'HKD',
          delta: { current: 80, previous: 120, delta: -40, percent: -33, hasPrevious: true },
        }),
      ]),
    );
    assert.equal(down.wins[0]?.id, 'spendDown');

    const up = buildWeeklyInsightsBrief(
      weeklyReport({ pressure: 'spendUp' }),
      weeklyBoard([
        tile({
          id: 'spend',
          unit: 'money',
          flavor: 'moreIsBad',
          value: 150,
          currency: 'HKD',
          delta: { current: 150, previous: 100, delta: 50, percent: 50, hasPrevious: true },
        }),
      ]),
    );
    assert.equal(up.risks[0]?.id, 'spendUp');
    assert.equal(up.risks[0]?.value, 50);
  });
});

describe('buildMonthlyInsightsBrief', () => {
  it('flags net-worth slip and envelope break without inventing writing wins', () => {
    const brief = buildMonthlyInsightsBrief(
      monthlyReport({
        writingDays: 1,
        budgetOverCount: 1,
        pressure: 'budget',
        hasNetWorthSnapshot: true,
        netWorthDelta: -200,
      }),
      monthlyBoard([
        tile({ id: 'worth', unit: 'money', value: -200, currency: 'HKD', flavor: 'moreIsGood' }),
      ]),
    );
    assert.deepEqual(brief.wins, []);
    assert.ok(brief.risks.some((row) => row.id === 'worthDown'));
    assert.ok(brief.risks.some((row) => row.id === 'budgetOver' && row.value === 1));
    assert.equal(brief.actionHref, '/(tabs)/money?segment=cashflow');
  });
});
