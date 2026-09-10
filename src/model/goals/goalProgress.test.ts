import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isoAtLocalNoon } from '../../utils/dateUtils';
import type { Goal } from './Goal';
import {
  clampRatio,
  dayKeyDiff,
  daysUntilTarget,
  goalProgress,
  linkedHabitProgress,
  metricProgress,
  pickFocusGoal,
  ratioToPercent,
  timeProgress,
} from './goalProgress';

/**
 * Purpose: Goal fixture for progress / pick tests.
 * Inputs: partial overrides.
 * Outputs: Goal.
 * Side effects: none.
 */
function goal(partial: Partial<Goal> & Pick<Goal, 'id' | 'title'>): Goal {
  return {
    why: '',
    targetDate: '2026-12-01',
    linkedReminderIds: [],
    status: 'active',
    createdAt: isoAtLocalNoon('2026-01-01'),
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('clampRatio / ratioToPercent', () => {
  it('clamps non-finite and out-of-range values', () => {
    assert.equal(clampRatio(0.4), 0.4);
    assert.equal(clampRatio(-1), 0);
    assert.equal(clampRatio(2), 1);
    assert.equal(clampRatio(Number.NaN), 0);
    assert.equal(ratioToPercent(0.336), 34);
    assert.equal(ratioToPercent(1.2), 100);
  });
});

describe('metricProgress', () => {
  it('uses current / target and clamps at 100%', () => {
    assert.equal(metricProgress({ target: 10, current: 4, unit: 'km' }), 0.4);
    assert.equal(metricProgress({ target: 10, current: 40, unit: 'km' }), 1);
    assert.equal(metricProgress({ target: 10, current: -3, unit: 'km' }), 0);
  });

  it('treats non-positive target as done only when current is positive', () => {
    assert.equal(metricProgress({ target: 0, current: 0, unit: '' }), 0);
    assert.equal(metricProgress({ target: 0, current: 2, unit: '' }), 1);
    assert.equal(metricProgress({ target: -5, current: 1, unit: 'x' }), 1);
  });
});

describe('timeProgress / dayKeyDiff', () => {
  it('counts civil-day deltas without DST drift', () => {
    assert.equal(dayKeyDiff('2026-01-01', '2026-01-11'), 10);
    assert.equal(dayKeyDiff('2026-09-10', '2026-09-10'), 0);
    assert.equal(dayKeyDiff('2026-09-10', '2026-09-09'), -1);
  });

  it('is 0 before start, 1 on/after target, else elapsed / span', () => {
    assert.equal(timeProgress('2026-01-01', '2026-01-11', '2025-12-31'), 0);
    assert.equal(timeProgress('2026-01-01', '2026-01-11', '2026-01-01'), 0);
    assert.equal(timeProgress('2026-01-01', '2026-01-11', '2026-01-06'), 0.5);
    assert.equal(timeProgress('2026-01-01', '2026-01-11', '2026-01-11'), 1);
    assert.equal(timeProgress('2026-01-01', '2026-01-11', '2026-02-01'), 1);
  });

  it('treats same-day or inverted span as done once now reaches the target', () => {
    assert.equal(timeProgress('2026-09-10', '2026-09-10', '2026-09-10'), 1);
    assert.equal(timeProgress('2026-09-12', '2026-09-10', '2026-09-09'), 0);
    assert.equal(timeProgress('2026-09-12', '2026-09-10', '2026-09-10'), 1);
  });
});

describe('linkedHabitProgress', () => {
  it('returns null when there are no linked ids or none resolve', () => {
    const empty = goal({ id: 'g1', title: '10k' });
    assert.equal(linkedHabitProgress(empty, []), null);

    const dangling = goal({ id: 'g1', title: '10k', linkedReminderIds: ['missing'] });
    assert.equal(linkedHabitProgress(dangling, [{ id: 'other', completedDayKeys: ['2026-01-02'] }]), null);
  });

  it('averages check-in density in the window and skips deleted links', () => {
    const now = new Date(2026, 0, 11, 12, 0, 0);
    const item = goal({
      id: 'g1',
      title: '10k',
      createdAt: isoAtLocalNoon('2026-01-01'),
      targetDate: '2026-01-20',
      linkedReminderIds: ['run', 'gone'],
    });
    const ratio = linkedHabitProgress(
      item,
      [{ id: 'run', completedDayKeys: ['2026-01-01', '2026-01-03', '2026-01-05', '2026-02-01'] }],
      now,
    );
    // Window 1–11 Jan = 11 days; 3 hits in window (Feb dropped) → 3/11.
    assert.ok(ratio !== null);
    assert.equal(ratio, 3 / 11);
  });
});

describe('goalProgress', () => {
  it('prefers metric over habits over calendar time', () => {
    const now = new Date(2026, 5, 1, 12, 0, 0);
    const withMetric = goal({
      id: 'g1',
      title: '10k',
      metric: { target: 10, current: 2.5, unit: 'km' },
      linkedReminderIds: ['run'],
    });
    const metric = goalProgress(withMetric, now, [{ id: 'run', completedDayKeys: ['2026-01-02'] }]);
    assert.equal(metric.source, 'metric');
    assert.equal(metric.percent, 25);

    const withHabits = goal({
      id: 'g2',
      title: 'Read',
      createdAt: isoAtLocalNoon('2026-01-01'),
      targetDate: '2026-01-11',
      linkedReminderIds: ['pages'],
    });
    const habits = goalProgress(
      withHabits,
      new Date(2026, 0, 11, 12, 0, 0),
      [{ id: 'pages', completedDayKeys: ['2026-01-01'] }],
    );
    assert.equal(habits.source, 'habits');

    const timed = goal({
      id: 'g3',
      title: 'Save',
      createdAt: isoAtLocalNoon('2026-01-01'),
      targetDate: '2026-01-11',
    });
    const calendar = goalProgress(timed, new Date(2026, 0, 6, 12, 0, 0));
    assert.equal(calendar.source, 'time');
    assert.equal(calendar.percent, 50);
  });
});

describe('pickFocusGoal / daysUntilTarget', () => {
  it('returns the soonest active goal and ignores paused/done', () => {
    const paused = goal({ id: 'p', title: 'Paused', status: 'paused', targetDate: '2026-09-01' });
    const done = goal({ id: 'd', title: 'Done', status: 'done', targetDate: '2026-09-02' });
    const later = goal({ id: 'b', title: 'Later', targetDate: '2026-11-01', updatedAt: '2026-02-01T00:00:00.000Z' });
    const sooner = goal({ id: 'a', title: 'Soon', targetDate: '2026-10-01', updatedAt: '2026-01-01T00:00:00.000Z' });
    const picked = pickFocusGoal([paused, done, later, sooner]);
    assert.equal(picked?.id, 'a');
    assert.equal(pickFocusGoal([paused, done]), null);
  });

  it('breaks same-date ties with the newer updatedAt', () => {
    const older = goal({
      id: 'old',
      title: 'Old',
      targetDate: '2026-10-01',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const newer = goal({
      id: 'new',
      title: 'New',
      targetDate: '2026-10-01',
      updatedAt: '2026-03-01T00:00:00.000Z',
    });
    assert.equal(pickFocusGoal([older, newer])?.id, 'new');
  });

  it('reports signed days until the target civil day', () => {
    const now = new Date(2026, 8, 10, 15, 0, 0);
    assert.equal(daysUntilTarget('2026-09-10', now), 0);
    assert.equal(daysUntilTarget('2026-09-13', now), 3);
    assert.equal(daysUntilTarget('2026-09-08', now), -2);
  });
});
