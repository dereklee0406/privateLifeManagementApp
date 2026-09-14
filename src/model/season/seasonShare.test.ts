import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSeasonShareFacts } from './seasonShare';
import type { SeasonRank } from './seasonRank';

/**
 * Purpose: language-free Season snapshot for share tests.
 * Inputs: overrides.
 * Outputs: SeasonRank.
 * Side effects: none.
 */
function season(overrides: Partial<SeasonRank> = {}): SeasonRank {
  return {
    rank: 'forge',
    score: 0.53,
    writingDays30: 12,
    writingRate: 0.4,
    habitHitRate: 0.7,
    budgetDiscipline: 0.5,
    bestCurrentStreak: 3,
    windowDays: 30,
    ...overrides,
  };
}

describe('buildSeasonShareFacts', () => {
  it('rounds the score, maps present pillars, and keeps a Temper nudge', () => {
    const facts = buildSeasonShareFacts(season(), {
      currentScore: 53,
      previousScore: 40,
      points: 13,
      direction: 'up',
    });
    assert.equal(facts.rank, 'forge');
    assert.equal(facts.score, 53);
    assert.deepEqual(
      facts.pillars.map((pillar) => pillar.id),
      ['writing', 'habits', 'budget'],
    );
    assert.equal(facts.nudge?.nextRank, 'temper');
    assert.equal(facts.nudge?.points, 12);
    assert.equal(facts.trend?.direction, 'up');
  });

  it('omits missing pillars and hides the nudge at Steel', () => {
    const facts = buildSeasonShareFacts(
      season({
        rank: 'steel',
        score: 0.9,
        habitHitRate: null,
        budgetDiscipline: null,
      }),
      null,
    );
    assert.deepEqual(
      facts.pillars.map((pillar) => pillar.id),
      ['writing'],
    );
    assert.equal(facts.nudge, null);
    assert.equal(facts.trend, null);
  });
});
