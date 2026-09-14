import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildTodaySummary, hrefForPressure } from './todaySummary';
import type { TodayPrediction } from './predictions';

/**
 * Purpose: minimal prediction fixture for summary de-dupe tests.
 * Inputs: kind + optional source.
 * Outputs: TodayPrediction.
 * Side effects: none.
 */
function prediction(
  kind: TodayPrediction['kind'],
  lineKey = 'predictions.overdue',
): TodayPrediction {
  return {
    kind,
    href: '/reminders/x',
    lineKey,
    lineParams: { title: 'Visa' },
    sourceId: 'x',
  };
}

describe('hrefForPressure', () => {
  it('routes overdue and habits to Focus, money to Wallet, writing to Journal', () => {
    assert.equal(hrefForPressure('overdue'), '/(tabs)/calendar?tab=tasks');
    assert.equal(hrefForPressure('habits'), '/(tabs)/calendar?tab=streaks');
    assert.equal(hrefForPressure('budget'), '/(tabs)/money?segment=cashflow');
    assert.equal(hrefForPressure('spendUp'), '/(tabs)/money?segment=cashflow');
    assert.equal(hrefForPressure('worth'), '/(tabs)/money?segment=worth');
    assert.equal(hrefForPressure('writing'), '/(tabs)/journal');
    assert.equal(hrefForPressure('quiet'), '/(tabs)/journal');
    assert.equal(hrefForPressure('steady'), '/(tabs)');
  });
});

describe('buildTodaySummary', () => {
  it('returns empty when there is nothing true to say', () => {
    assert.deepEqual(
      buildTodaySummary({
        pressure: 'quiet',
        prediction: null,
        daysWritten: 0,
        habitHitRate: null,
      }),
      [],
    );
    assert.deepEqual(
      buildTodaySummary({
        pressure: 'steady',
        prediction: null,
        daysWritten: 0,
        habitHitRate: null,
      }),
      [],
    );
  });

  it('caps at three lines and skips a prediction that restates pressure', () => {
    const lines = buildTodaySummary({
      pressure: 'overdue',
      prediction: prediction('due'),
      daysWritten: 2,
      habitHitRate: 0.8,
    });
    assert.equal(lines.length, 2);
    assert.equal(lines[0]?.kind, 'pressure');
    assert.equal(lines[1]?.kind, 'writingDays');
    if (lines[1]?.kind === 'writingDays') {
      assert.equal(lines[1].days, 2);
    }
  });

  it('keeps a distinct prediction, then a writing fact, and hard-caps at 3', () => {
    const lines = buildTodaySummary({
      pressure: 'habits',
      prediction: prediction('renewal', 'predictions.renewal'),
      daysWritten: 4,
      habitHitRate: 0.2,
    });
    assert.equal(lines.length, 3);
    assert.deepEqual(
      lines.map((line) => line.kind),
      ['pressure', 'prediction', 'writingDays'],
    );
  });

  it('uses habit hits when there are no writing days', () => {
    const lines = buildTodaySummary({
      pressure: 'steady',
      prediction: null,
      daysWritten: 0,
      habitHitRate: 0.5,
    });
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.kind, 'habitHits');
    if (lines[0]?.kind === 'habitHits') {
      assert.equal(lines[0].percent, 50);
    }
  });
});
