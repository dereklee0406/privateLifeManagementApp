import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MonthlyInsightsReport } from './monthlyReport';
import { buildMonthlyShareFacts } from './monthlyShare';

describe('buildMonthlyShareFacts', () => {
  it('copies board-pack facts and Season without inventing copy', () => {
    const report: MonthlyInsightsReport = {
      pageCount: 4,
      writingDays: 3,
      wordCount: 80,
      habitHitRate: 0.8,
      activeHabitCount: 2,
      spent: 400,
      previousSpent: 500,
      spendPercentChange: -20,
      hasPreviousSpend: true,
      currency: 'HKD',
      budgetOverCount: 0,
      budgetCount: 1,
      netWorthDelta: 200,
      hasNetWorthSnapshot: true,
      pressure: 'steady',
    };
    const facts = buildMonthlyShareFacts(report, 'forge', new Date(2026, 8, 12));
    assert.equal(facts.monthKey, '2026-09');
    assert.equal(facts.seasonRank, 'forge');
    assert.equal(facts.pageCount, 4);
    assert.equal(facts.writingDays, 3);
    assert.equal(facts.habitPercent, 80);
    assert.equal(facts.spendPercentChange, -20);
    assert.equal(facts.netWorthDelta, 200);
    assert.equal(facts.pressure, 'steady');
    assert.equal(facts.currency, 'HKD');
  });

  it('keeps a missing habit rate as null', () => {
    const report: MonthlyInsightsReport = {
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
    };
    const facts = buildMonthlyShareFacts(report, 'spark', new Date(2026, 8, 1));
    assert.equal(facts.habitPercent, null);
    assert.equal(facts.hasNetWorthSnapshot, false);
  });
});
