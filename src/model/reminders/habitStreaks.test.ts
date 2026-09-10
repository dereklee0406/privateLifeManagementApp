import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Reminder } from './Reminder';
import {
  calculateHabitStreak,
  computeOverallHabitRhythm,
  generateHeatmapMatrix,
  habitHitRateBetween,
} from './habitStreaks';

/**
 * Purpose: minimal Reminder fixture for streak / heatmap tests.
 * Inputs: partial overrides (id + title required-ish).
 * Outputs: Reminder.
 * Side effects: none.
 */
function reminder(partial: Partial<Reminder> & Pick<Reminder, 'id' | 'title'>): Reminder {
  return {
    kind: 'goal',
    hour: 8,
    minute: 0,
    enabled: true,
    recurrence: { type: 'daily' },
    priority: 'normal',
    categoryPath: { top: 'health' },
    anchorAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('calculateHabitStreak', () => {
  it('counts current streak from today when checked, or from yesterday when pending', () => {
    const todayKey = '2026-03-15';
    const withToday = reminder({
      id: 'meditate',
      title: 'Meditate',
      completedDayKeys: ['2026-03-13', '2026-03-14', '2026-03-15'],
    });
    const checked = calculateHabitStreak(withToday, todayKey);
    assert.equal(checked.isCompletedToday, true);
    assert.equal(checked.currentStreak, 3);
    assert.equal(checked.totalCompletions, 3);

    const pending = reminder({
      id: 'meditate',
      title: 'Meditate',
      completedDayKeys: ['2026-03-13', '2026-03-14'],
    });
    const pendingResult = calculateHabitStreak(pending, todayKey);
    assert.equal(pendingResult.isCompletedToday, false);
    assert.equal(pendingResult.currentStreak, 2);

    const broken = reminder({
      id: 'meditate',
      title: 'Meditate',
      completedDayKeys: ['2026-03-12'],
    });
    const brokenResult = calculateHabitStreak(broken, todayKey);
    assert.equal(brokenResult.currentStreak, 0);
    assert.equal(brokenResult.isCompletedToday, false);
  });

  it('computes best streak across broken sequences and 30-day consistency', () => {
    const todayKey = '2026-03-20';
    // Best run: Mar 1–5 (5 days). Later: Mar 10–12 (3). Current ends Mar 18–20 (3).
    const habit = reminder({
      id: 'run',
      title: 'Run',
      completedDayKeys: [
        '2026-03-01',
        '2026-03-02',
        '2026-03-03',
        '2026-03-04',
        '2026-03-05',
        '2026-03-10',
        '2026-03-11',
        '2026-03-12',
        '2026-03-18',
        '2026-03-19',
        '2026-03-20',
      ],
    });
    const result = calculateHabitStreak(habit, todayKey);
    assert.equal(result.bestStreak, 5);
    assert.equal(result.currentStreak, 3);
    assert.equal(result.totalCompletions, 11);
    // 11 completions all within the trailing 30 days → 11/30
    assert.equal(result.consistencyRate30Days, 11 / 30);
  });

  it('returns zeros for habits with no completions', () => {
    const empty = calculateHabitStreak(reminder({ id: 'empty', title: 'Empty' }), '2026-03-15');
    assert.equal(empty.currentStreak, 0);
    assert.equal(empty.bestStreak, 0);
    assert.equal(empty.totalCompletions, 0);
    assert.equal(empty.consistencyRate30Days, 0);
    assert.equal(empty.isCompletedToday, false);
  });
});

describe('generateHeatmapMatrix', () => {
  it('builds 13 weeks × 7 days (Mon–Sun) with density levels', () => {
    // Sunday 2026-03-15 — week Mon Mar 9 … Sun Mar 15.
    const today = new Date(2026, 2, 15);
    const keys = [
      '2026-03-15', // today: 1
      '2026-03-14',
      '2026-03-14', // duplicate → count 2 for single-habit flat list
      '2026-03-13',
      '2026-03-13',
      '2026-03-13', // count 3
    ];
    const matrix = generateHeatmapMatrix(keys, 13, today);

    assert.equal(matrix.length, 13);
    for (const column of matrix) {
      assert.equal(column.length, 7);
    }

    // Last column is the week of today: Mon 9 … Sun 15.
    const lastWeek = matrix[12]!;
    assert.equal(lastWeek[0]!.dayKey, '2026-03-09'); // Monday
    assert.equal(lastWeek[6]!.dayKey, '2026-03-15'); // Sunday
    assert.equal(lastWeek[6]!.isToday, true);
    assert.equal(lastWeek[6]!.level, 1);
    assert.equal(lastWeek[5]!.dayKey, '2026-03-14');
    assert.equal(lastWeek[5]!.count, 2);
    assert.equal(lastWeek[5]!.level, 2);
    assert.equal(lastWeek[4]!.count, 3);
    assert.equal(lastWeek[4]!.level, 3);

    // First cell is 13 weeks earlier: Mon 2025-12-15.
    assert.equal(matrix[0]![0]!.dayKey, '2025-12-15');

    // Multi-habit nested arrays: count how many habits hit the day.
    const multi = generateHeatmapMatrix(
      [
        ['2026-03-15', '2026-03-14'],
        ['2026-03-15'],
        ['2026-03-15', '2026-03-13'],
      ],
      13,
      today,
    );
    const sun = multi[12]![6]!;
    assert.equal(sun.count, 3);
    assert.equal(sun.level, 3);

    // Level 4+ band.
    const dense = generateHeatmapMatrix(
      [
        ['2026-03-15'],
        ['2026-03-15'],
        ['2026-03-15'],
        ['2026-03-15'],
      ],
      1,
      today,
    );
    assert.equal(dense[0]![6]!.level, 4);
  });

  it('marks future days in the current week as isFuture with level 0', () => {
    // Wednesday 2026-03-11 — Thu–Sun are future in the same week.
    const today = new Date(2026, 2, 11);
    const matrix = generateHeatmapMatrix(['2026-03-11'], 1, today);
    const week = matrix[0]!;
    assert.equal(week[2]!.dayKey, '2026-03-11'); // Wed
    assert.equal(week[2]!.isToday, true);
    assert.equal(week[3]!.isFuture, true); // Thu
    assert.equal(week[3]!.level, 0);
    assert.equal(week[6]!.isFuture, true); // Sun
  });
});

describe('computeOverallHabitRhythm', () => {
  it('aggregates active recurring habits into an overall rhythm summary', () => {
    const todayKey = '2026-03-15';
    const habits = [
      reminder({
        id: 'a',
        title: 'A',
        completedDayKeys: ['2026-03-13', '2026-03-14', '2026-03-15'],
      }),
      reminder({
        id: 'b',
        title: 'B',
        completedDayKeys: ['2026-03-14'],
      }),
      reminder({
        id: 'once',
        title: 'Once',
        recurrence: { type: 'once', dayKey: '2026-03-15' },
        completedDayKeys: ['2026-03-15'],
      }),
      reminder({
        id: 'off',
        title: 'Off',
        enabled: false,
        completedDayKeys: ['2026-03-15'],
      }),
    ];

    const rhythm = computeOverallHabitRhythm(habits, todayKey);
    assert.equal(rhythm.activeHabitCount, 2);
    assert.equal(rhythm.todayCompletedCount, 1);
    assert.equal(rhythm.bestCurrentStreak, 3);
    // Habit A: 3/30, Habit B: 1/30 → mean 2/30
    assert.equal(rhythm.overallConsistency30Days, (3 / 30 + 1 / 30) / 2);
  });

  it('returns empty rhythm when no active recurring habits exist', () => {
    const rhythm = computeOverallHabitRhythm(
      [reminder({ id: 'x', title: 'X', enabled: false })],
      '2026-03-15',
    );
    assert.deepEqual(rhythm, {
      activeHabitCount: 0,
      todayCompletedCount: 0,
      overallConsistency30Days: 0,
      bestCurrentStreak: 0,
    });
  });
});

describe('habitHitRateBetween', () => {
  it('averages unique hits in the window and returns null with no active habits', () => {
    const run = reminder({
      id: 'run',
      title: 'Run',
      completedDayKeys: ['2026-09-01', '2026-09-02', '2026-09-08'],
    });
    const hit = habitHitRateBetween([run], '2026-09-01', '2026-09-04');
    assert.equal(hit.activeHabitCount, 1);
    assert.equal(hit.rate, 0.5);

    const none = habitHitRateBetween(
      [reminder({ id: 'once', title: 'Once', recurrence: { type: 'once', dayKey: '2026-09-01' } })],
      '2026-09-01',
      '2026-09-04',
    );
    assert.equal(none.rate, null);
    assert.equal(none.activeHabitCount, 0);
  });
});
