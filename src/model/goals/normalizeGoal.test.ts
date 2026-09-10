import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { blankGoalDraft, isGoalDraftValid } from './Goal';
import { normalizeGoal, normalizeGoals } from './normalizeGoal';

describe('normalizeGoals', () => {
  it('returns empty for non-arrays and drops unreadable rows', () => {
    assert.deepEqual(normalizeGoals(null), []);
    assert.deepEqual(normalizeGoals('nope'), []);
    const rows = normalizeGoals([
      {
        id: 'g1',
        title: '  Run a 10k  ',
        why: 'Race in November',
        targetDate: '2026-11-01',
        metric: { target: 10, current: 3, unit: 'km' },
        linkedReminderIds: ['r1', 'r1', '  ', 9, 'r2'],
        status: 'paused',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z',
      },
      { id: 'bad', title: 'No date' },
      null,
      { title: 'missing id', targetDate: '2026-11-01' },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.id, 'g1');
    assert.equal(rows[0]?.title, 'Run a 10k');
    assert.equal(rows[0]?.status, 'paused');
    assert.deepEqual(rows[0]?.linkedReminderIds, ['r1', 'r2']);
    assert.deepEqual(rows[0]?.metric, { target: 10, current: 3, unit: 'km' });
  });

  it('defaults status, why, and missing metric; rejects empty title', () => {
    const ok = normalizeGoal({
      id: 'g2',
      title: 'Save',
      targetDate: '2026-12-31',
    });
    assert.equal(ok?.status, 'active');
    assert.equal(ok?.why, '');
    assert.equal(ok?.metric, undefined);
    assert.deepEqual(ok?.linkedReminderIds, []);

    assert.equal(normalizeGoal({ id: 'g3', title: '   ', targetDate: '2026-12-31' }), null);
    assert.equal(normalizeGoal({ id: 'g4', title: 'X', targetDate: '12-31-2026' }), null);
  });
});

describe('isGoalDraftValid / blankGoalDraft', () => {
  it('requires a trimmed title and a day-key target', () => {
    const blank = blankGoalDraft(new Date(2026, 0, 1, 12, 0, 0));
    assert.equal(blank.status, 'active');
    assert.equal(blank.targetDate, '2026-04-01');
    assert.equal(isGoalDraftValid(blank), false);
    assert.equal(isGoalDraftValid({ ...blank, title: '  10k  ' }), true);
    assert.equal(isGoalDraftValid({ ...blank, title: '10k', targetDate: 'soon' }), false);
  });
});
