import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  civilDayForMonthly,
  clampDayOfMonth,
  lastDayOfMonth,
  nextFireAt,
} from './nextFire';

describe('monthly day clamping', () => {
  it('clamps day 31 onto Feb 28/29 and April 30 (TC-ENG-12)', () => {
    assert.equal(lastDayOfMonth(2026, 1), 28);
    assert.equal(lastDayOfMonth(2024, 1), 29);
    assert.equal(clampDayOfMonth(2026, 2, 31), 28);
    assert.equal(clampDayOfMonth(2024, 2, 31), 29);
    assert.equal(clampDayOfMonth(2026, 4, 31), 30);
    assert.equal(clampDayOfMonth(2026, 1, 31), 31);

    assert.equal(civilDayForMonthly(2026, 1, { dayOfMonth: 31 }), 28);
    assert.equal(civilDayForMonthly(2024, 1, { dayOfMonth: 31 }), 29);
    assert.equal(civilDayForMonthly(2026, 3, { dayOfMonth: 31 }), 30);
    assert.equal(civilDayForMonthly(2026, 0, { dayOfMonth: 31 }), 31);
    assert.equal(civilDayForMonthly(2026, 1, { dayOfMonth: 15, monthAnchor: 'end' }), 28);
    assert.equal(civilDayForMonthly(2026, 1, { dayOfMonth: 15, monthAnchor: 'start' }), 1);
  });

  it('nextFireAt monthly clamps when this month already passed', () => {
    // 2026-03-01 morning: March still has a clamped 31st → fires March 31.
    const before = nextFireAt(
      {
        recurrence: { type: 'monthly', dayOfMonth: 31 },
        hour: 10,
        minute: 0,
        anchorAt: '2026-01-01T00:00:00.000Z',
      },
      new Date(2026, 2, 1, 9, 0, 0, 0),
    );
    assert.ok(before, 'expected March fire');
    assert.equal(before!.getFullYear(), 2026);
    assert.equal(before!.getMonth(), 2);
    assert.equal(before!.getDate(), 31);

    // After March 31 fire: next is April 30 (clamped).
    const after = nextFireAt(
      {
        recurrence: { type: 'monthly', dayOfMonth: 31 },
        hour: 10,
        minute: 0,
        anchorAt: '2026-01-01T00:00:00.000Z',
      },
      new Date(2026, 2, 31, 10, 0, 1, 0),
    );
    assert.ok(after, 'expected April fire');
    assert.equal(after!.getMonth(), 3);
    assert.equal(after!.getDate(), 30);
  });
});

describe('weekday recurrence', () => {
  it('skips Saturday and Sunday for Mon–Fri weekly rules (TC-ENG-13)', () => {
    // Friday 2026-03-13 11:00 — next weekday fire is Monday 16th (skips Sat/Sun).
    const friday = new Date(2026, 2, 13, 11, 0, 0, 0);
    assert.equal(friday.getDay(), 5);
    const next = nextFireAt(
      {
        recurrence: { type: 'weekly', weekdays: [1, 2, 3, 4, 5] },
        hour: 9,
        minute: 0,
        anchorAt: '2026-01-01T00:00:00.000Z',
      },
      friday,
    );
    assert.ok(next, 'expected Monday after Friday');
    assert.equal(next!.getDay(), 1);
    assert.equal(next!.getDate(), 16);
    assert.equal(next!.getHours(), 9);

    // Saturday morning also lands on Monday.
    const saturday = nextFireAt(
      {
        recurrence: { type: 'weekly', weekdays: [1, 2, 3, 4, 5] },
        hour: 9,
        minute: 0,
        anchorAt: '2026-01-01T00:00:00.000Z',
      },
      new Date(2026, 2, 14, 8, 0, 0, 0),
    );
    assert.ok(saturday, 'expected Monday after Saturday');
    assert.equal(saturday!.getDay(), 1);
    assert.equal(saturday!.getDate(), 16);
  });
});

describe('next or same civil day', () => {
  it('fires later today when clock has not passed, else next civil day', () => {
    const rule = {
      recurrence: { type: 'daily' as const },
      hour: 21,
      minute: 0,
      anchorAt: '2026-03-10T00:00:00.000Z',
    };

    const morning = nextFireAt(rule, new Date(2026, 2, 10, 9, 0, 0, 0));
    assert.ok(morning, 'expected same-day fire');
    assert.equal(morning!.getDate(), 10);
    assert.equal(morning!.getHours(), 21);

    const night = nextFireAt(rule, new Date(2026, 2, 10, 21, 0, 1, 0));
    assert.ok(night, 'expected next-day fire');
    assert.equal(night!.getDate(), 11);
    assert.equal(night!.getHours(), 21);
  });
});
