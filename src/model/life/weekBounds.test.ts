import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { alignedPreviousWeekSoFar, lastFullWeek, thisWeekSoFar } from './weekBounds';

describe('alignedPreviousWeekSoFar', () => {
  it('matches this week’s weekday span on the previous week (Mon start)', () => {
    const now = new Date(2026, 8, 9, 15); // Wednesday 9 Sep 2026
    const current = thisWeekSoFar(now, 'monday');
    const aligned = alignedPreviousWeekSoFar(now, 'monday');
    const last = lastFullWeek(now, 'monday');
    assert.equal(current.startKey, '2026-09-07');
    assert.equal(current.endKey, '2026-09-09');
    assert.equal(last.startKey, '2026-08-31');
    assert.equal(aligned.startKey, '2026-08-31');
    assert.equal(aligned.endKey, '2026-09-02');
  });

  it('stays a single day when today is the week start', () => {
    const now = new Date(2026, 8, 7, 9); // Monday
    const aligned = alignedPreviousWeekSoFar(now, 'monday');
    assert.equal(aligned.startKey, '2026-08-31');
    assert.equal(aligned.endKey, '2026-08-31');
  });
});
