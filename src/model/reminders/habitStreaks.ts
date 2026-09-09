import { toDayKey } from '../../utils/dateUtils';
import type { Reminder } from './Reminder';

/**
 * Purpose: streak analytics for one habit reminder.
 * Inputs: calculateHabitStreak.
 * Outputs: streak cards + consistency bar.
 */
export interface HabitStreakResult {
  currentStreak: number;
  bestStreak: number;
  isCompletedToday: boolean;
  totalCompletions: number;
  consistencyRate30Days: number;
}

/**
 * Purpose: one cell in the 90-day tactile rhythm matrix.
 * Inputs: generateHeatmapMatrix.
 * Outputs: density level and day metadata for rendering.
 */
export interface HeatmapCell {
  dayKey: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
  isFuture: boolean;
}

/**
 * Purpose: aggregated rhythm across all active recurring habits.
 * Inputs: computeOverallHabitRhythm.
 * Outputs: header summary on the Habit Streaks screen.
 */
export interface OverallHabitRhythm {
  activeHabitCount: number;
  todayCompletedCount: number;
  overallConsistency30Days: number;
  bestCurrentStreak: number;
}

const CONSISTENCY_WINDOW_DAYS = 30;

/**
 * Purpose: shift a YYYY-MM-DD key by a signed day offset in local civil time.
 * Inputs: day key, integer offset (negative = past).
 * Outputs: new YYYY-MM-DD.
 * Side effects: none.
 */
function shiftDayKey(dayKey: string, offsetDays: number): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  const date = new Date(year, (month ?? 1) - 1, (day ?? 1) + offsetDays);
  return toDayKey(date);
}

/**
 * Purpose: Monday (local) of the week containing `value` (Mon–Sun weeks).
 * Inputs: Date.
 * Outputs: local midnight on that Monday.
 * Side effects: none.
 */
function mondayOfWeek(value: Date): Date {
  const start = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const day = start.getDay(); // 0 = Sun … 6 = Sat
  const offset = day === 0 ? -6 : 1 - day;
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
}

/**
 * Purpose: map a completion count onto heatmap density 0–4.
 * Inputs: completions that day (0+).
 * Outputs: level band.
 * Side effects: none.
 * Design decisions: 0→0, 1→1, 2→2, 3→3, 4+→4.
 */
function countToLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) {
    return 0;
  }
  if (count === 1) {
    return 1;
  }
  if (count === 2) {
    return 2;
  }
  if (count === 3) {
    return 3;
  }
  return 4;
}

/**
 * Purpose: unique sorted day keys from a reminder’s completion log.
 * Inputs: Reminder.completedDayKeys.
 * Outputs: sorted unique YYYY-MM-DD list.
 * Side effects: none.
 */
function uniqueSortedKeys(keys: string[] | undefined): string[] {
  if (!keys?.length) {
    return [];
  }
  return [...new Set(keys.filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key)))].sort();
}

/**
 * Purpose: longest consecutive run of civil days in a sorted unique key list.
 * Inputs: ascending YYYY-MM-DD keys.
 * Outputs: best streak length (0 when empty).
 * Side effects: none.
 */
function longestConsecutiveRun(sortedKeys: string[]): number {
  if (sortedKeys.length === 0) {
    return 0;
  }
  let best = 1;
  let run = 1;
  for (let index = 1; index < sortedKeys.length; index += 1) {
    const prev = sortedKeys[index - 1]!;
    const curr = sortedKeys[index]!;
    if (shiftDayKey(prev, 1) === curr) {
      run += 1;
      if (run > best) {
        best = run;
      }
    } else {
      run = 1;
    }
  }
  return best;
}

/**
 * Purpose: whether a reminder is an active recurring habit (not a one-shot).
 * Inputs: Reminder.
 * Outputs: true when enabled and recurrence is not `once`.
 * Side effects: none.
 */
function isActiveRecurringHabit(reminder: Reminder): boolean {
  return reminder.enabled && reminder.recurrence.type !== 'once';
}

/**
 * Purpose: compute current/best streak and 30-day consistency for one habit.
 * Inputs: Reminder (uses completedDayKeys), todayKey YYYY-MM-DD.
 * Outputs: HabitStreakResult.
 * Side effects: none.
 * Design decisions: current streak counts backward from today when checked off, otherwise from
 *   yesterday so a pending today does not break the flame; consistency is completions in the
 *   trailing 30 civil days ÷ 30.
 */
export function calculateHabitStreak(reminder: Reminder, todayKey: string): HabitStreakResult {
  const sorted = uniqueSortedKeys(reminder.completedDayKeys);
  const completed = new Set(sorted);
  const isCompletedToday = completed.has(todayKey);
  const totalCompletions = reminder.completedDayKeys?.length ?? 0;

  let currentStreak = 0;
  let cursor = isCompletedToday ? todayKey : shiftDayKey(todayKey, -1);
  while (completed.has(cursor)) {
    currentStreak += 1;
    cursor = shiftDayKey(cursor, -1);
  }

  const bestStreak = longestConsecutiveRun(sorted);

  let completedInWindow = 0;
  for (let offset = 0; offset < CONSISTENCY_WINDOW_DAYS; offset += 1) {
    if (completed.has(shiftDayKey(todayKey, -offset))) {
      completedInWindow += 1;
    }
  }
  const consistencyRate30Days = completedInWindow / CONSISTENCY_WINDOW_DAYS;

  return {
    currentStreak,
    bestStreak,
    isCompletedToday,
    totalCompletions,
    consistencyRate30Days,
  };
}

/**
 * Purpose: build a completion-count map from one habit or many habits’ day keys.
 * Inputs: flat keys or per-habit key arrays.
 * Outputs: dayKey → count (habits completed that day, or occurrences for a single list).
 * Side effects: none.
 * Design decisions: nested arrays count each habit at most once per day; flat arrays tally
 *   occurrences (normally 0/1 for a single habit).
 */
function buildCompletionCounts(completedDayKeys: string[] | string[][]): Map<string, number> {
  const counts = new Map<string, number>();
  if (completedDayKeys.length === 0) {
    return counts;
  }
  const first = completedDayKeys[0];
  if (Array.isArray(first)) {
    for (const habitKeys of completedDayKeys as string[][]) {
      for (const key of new Set(habitKeys)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
          continue;
        }
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  }
  for (const key of completedDayKeys as string[]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
      continue;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * Purpose: generate a weeks × 7 (Mon–Sun) heatmap matrix ending on the week of `today`.
 * Inputs: completed day keys (one habit or all habits), week column count (default 13 ≈ 91 days), today.
 * Outputs: HeatmapCell[][] — outer = week columns (oldest → newest), inner = Mon…Sun.
 * Side effects: none.
 * Design decisions: future days after today stay level 0 with isFuture; density bands 0–4.
 */
export function generateHeatmapMatrix(
  completedDayKeys: string[] | string[][],
  weeksCount = 13,
  today: Date = new Date(),
): HeatmapCell[][] {
  const safeWeeks = Math.max(1, Math.floor(weeksCount));
  const todayKey = toDayKey(today);
  const counts = buildCompletionCounts(completedDayKeys);
  const endMonday = mondayOfWeek(today);
  const startMonday = new Date(
    endMonday.getFullYear(),
    endMonday.getMonth(),
    endMonday.getDate() - (safeWeeks - 1) * 7,
  );

  const matrix: HeatmapCell[][] = [];
  for (let week = 0; week < safeWeeks; week += 1) {
    const column: HeatmapCell[] = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const date = new Date(
        startMonday.getFullYear(),
        startMonday.getMonth(),
        startMonday.getDate() + week * 7 + weekday,
      );
      const dayKey = toDayKey(date);
      const count = counts.get(dayKey) ?? 0;
      const isToday = dayKey === todayKey;
      const isFuture = dayKey > todayKey;
      column.push({
        dayKey,
        count: isFuture ? 0 : count,
        level: isFuture ? 0 : countToLevel(count),
        isToday,
        isFuture,
      });
    }
    matrix.push(column);
  }
  return matrix;
}

/**
 * Purpose: roll up active recurring habits into an overall rhythm summary.
 * Inputs: reminders list, todayKey.
 * Outputs: OverallHabitRhythm.
 * Side effects: none.
 * Design decisions: only enabled non-once reminders count; overall consistency is the mean of
 *   each habit’s 30-day rate; bestCurrentStreak is the max current streak among them.
 */
export function computeOverallHabitRhythm(reminders: Reminder[], todayKey: string): OverallHabitRhythm {
  const habits = reminders.filter(isActiveRecurringHabit);
  if (habits.length === 0) {
    return {
      activeHabitCount: 0,
      todayCompletedCount: 0,
      overallConsistency30Days: 0,
      bestCurrentStreak: 0,
    };
  }

  let todayCompletedCount = 0;
  let consistencySum = 0;
  let bestCurrentStreak = 0;

  for (const habit of habits) {
    const streak = calculateHabitStreak(habit, todayKey);
    if (streak.isCompletedToday) {
      todayCompletedCount += 1;
    }
    consistencySum += streak.consistencyRate30Days;
    if (streak.currentStreak > bestCurrentStreak) {
      bestCurrentStreak = streak.currentStreak;
    }
  }

  return {
    activeHabitCount: habits.length,
    todayCompletedCount,
    overallConsistency30Days: consistencySum / habits.length,
    bestCurrentStreak,
  };
}
