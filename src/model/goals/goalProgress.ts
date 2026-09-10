import { toDayKey } from '../../utils/dateUtils';
import type { Goal, GoalMetric } from './Goal';
import { isGoalDayKey } from './Goal';

/**
 * Purpose: how a Goal’s 0–1 ratio was chosen (metric wins; else linked check-ins; else calendar).
 */
export type GoalProgressSource = 'metric' | 'habits' | 'time';

/**
 * Purpose: derived progress for Focus / Today — never persisted.
 * Inputs: Goal plus optional habit check-ins.
 * Outputs: clamped ratio, whole-number percent, and which rule applied.
 * Side effects: none.
 */
export interface GoalProgress {
  ratio: number;
  percent: number;
  source: GoalProgressSource;
}

/**
 * Purpose: reminder-shaped check-ins used only for linked-habit progress.
 * Inputs: Reminder rows (id + completed days). Full Reminder type is not required.
 * Outputs: consumed by linkedHabitProgress / goalProgress.
 * Side effects: none.
 */
export interface GoalCheckIn {
  id: string;
  completedDayKeys?: string[];
  lastCompletedAt?: string;
}

/**
 * Purpose: clamp a ratio into [0, 1].
 * Inputs: finite or non-finite number.
 * Outputs: 0–1 (non-finite → 0).
 * Side effects: none.
 */
export function clampRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

/**
 * Purpose: whole percent 0–100 from a 0–1 ratio (rounded).
 * Inputs: ratio.
 * Outputs: integer 0–100.
 * Side effects: none.
 */
export function ratioToPercent(ratio: number): number {
  return Math.round(clampRatio(ratio) * 100);
}

/**
 * Purpose: metric current / target as a 0–1 ratio.
 * Inputs: GoalMetric.
 * Outputs: clamped ratio. Target ≤ 0 counts as done when current > 0, else 0.
 * Side effects: none.
 */
export function metricProgress(metric: GoalMetric): number {
  const current = Number.isFinite(metric.current) ? Math.max(0, metric.current) : 0;
  const target = Number.isFinite(metric.target) ? metric.target : 0;
  if (target <= 0) {
    return current > 0 ? 1 : 0;
  }
  return clampRatio(current / target);
}

/**
 * Purpose: signed whole days from `fromKey` to `toKey` (local civil days).
 * Inputs: YYYY-MM-DD keys.
 * Outputs: integer day delta (to − from). Invalid keys → 0.
 * Side effects: none.
 * Design decisions: UTC noon of the Y-M-D parts avoids DST gaps.
 */
export function dayKeyDiff(fromKey: string, toKey: string): number {
  if (!isGoalDayKey(fromKey) || !isGoalDayKey(toKey)) {
    return 0;
  }
  const from = parseDayUtc(fromKey);
  const to = parseDayUtc(toKey);
  return Math.round((to - from) / 86_400_000);
}

/**
 * Purpose: calendar progress from start day through target day as of `nowKey`.
 * Inputs: start / target / now YYYY-MM-DD.
 * Outputs: 0 before start, 1 on/after target, else elapsed / span.
 * Side effects: none.
 */
export function timeProgress(startKey: string, targetKey: string, nowKey: string): number {
  const span = dayKeyDiff(startKey, targetKey);
  if (span <= 0) {
    return dayKeyDiff(nowKey, targetKey) <= 0 ? 1 : 0;
  }
  const elapsed = dayKeyDiff(startKey, nowKey);
  return clampRatio(elapsed / span);
}

/**
 * Purpose: average check-in density for linked reminders in the goal window so far.
 * Inputs: Goal, check-in rows, now.
 * Outputs: 0–1, or null when no linked ids resolve.
 * Side effects: none.
 * Design decisions: missing / deleted reminders are skipped so a broken link does not zero the bar.
 *   Density is completions in [start, min(now, target)] / elapsed days (inclusive).
 */
export function linkedHabitProgress(goal: Goal, checkIns: GoalCheckIn[], now: Date = new Date()): number | null {
  if (goal.linkedReminderIds.length === 0) {
    return null;
  }
  const byId = new Map(checkIns.map((item) => [item.id, item]));
  const found = goal.linkedReminderIds
    .map((id) => byId.get(id))
    .filter((item): item is GoalCheckIn => Boolean(item));
  if (found.length === 0) {
    return null;
  }
  const startKey = toDayKey(new Date(goal.createdAt));
  const nowKey = toDayKey(now);
  const windowEnd = nowKey < goal.targetDate ? nowKey : goal.targetDate;
  const elapsedDays = Math.max(1, dayKeyDiff(startKey, windowEnd) + 1);
  const ratios = found.map((item) => {
    const hits = completedKeysInWindow(item, startKey, windowEnd);
    return clampRatio(hits / elapsedDays);
  });
  const sum = ratios.reduce((total, ratio) => total + ratio, 0);
  return clampRatio(sum / ratios.length);
}

/**
 * Purpose: pick the single rule for a Goal’s progress bar.
 * Inputs: Goal, now, optional check-ins for linked habits.
 * Outputs: GoalProgress (metric > habits > time).
 * Side effects: none.
 */
export function goalProgress(goal: Goal, now: Date = new Date(), checkIns: GoalCheckIn[] = []): GoalProgress {
  if (goal.metric) {
    const ratio = metricProgress(goal.metric);
    return { ratio, percent: ratioToPercent(ratio), source: 'metric' };
  }
  const habits = linkedHabitProgress(goal, checkIns, now);
  if (habits !== null) {
    return { ratio: habits, percent: ratioToPercent(habits), source: 'habits' };
  }
  const startKey = toDayKey(new Date(goal.createdAt));
  const nowKey = toDayKey(now);
  const ratio = timeProgress(startKey, goal.targetDate, nowKey);
  return { ratio, percent: ratioToPercent(ratio), source: 'time' };
}

/**
 * Purpose: the one active Goal Today should surface (not a second hero).
 * Inputs: all goals.
 * Outputs: soonest-target active Goal, or null when none are active.
 * Side effects: none.
 * Design decisions: paused/done stay on Rhythm Focus only; ties break on newer updatedAt.
 */
export function pickFocusGoal(goals: Goal[]): Goal | null {
  const active = goals.filter((item) => item.status === 'active');
  if (active.length === 0) {
    return null;
  }
  const sorted = [...active].sort((left, right) => {
    const byDate = left.targetDate.localeCompare(right.targetDate);
    if (byDate !== 0) {
      return byDate;
    }
    return right.updatedAt.localeCompare(left.updatedAt);
  });
  return sorted[0] ?? null;
}

/**
 * Purpose: signed whole days until the target civil day (negative = overdue).
 * Inputs: target YYYY-MM-DD and now.
 * Outputs: integer; invalid target → 0.
 * Side effects: none.
 */
export function daysUntilTarget(targetDate: string, now: Date = new Date()): number {
  return dayKeyDiff(toDayKey(now), targetDate);
}

function parseDayUtc(dayKey: string): number {
  const [year, month, day] = dayKey.split('-').map(Number);
  return Date.UTC(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0);
}

function completedKeysInWindow(checkIn: GoalCheckIn, startKey: string, endKey: string): number {
  const keys = new Set<string>();
  for (const key of checkIn.completedDayKeys ?? []) {
    if (isGoalDayKey(key) && key >= startKey && key <= endKey) {
      keys.add(key);
    }
  }
  if (checkIn.lastCompletedAt) {
    const fromIso = toDayKey(new Date(checkIn.lastCompletedAt));
    if (isGoalDayKey(fromIso) && fromIso >= startKey && fromIso <= endKey) {
      keys.add(fromIso);
    }
  }
  return keys.size;
}
