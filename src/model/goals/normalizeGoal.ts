import { GOAL_STATUSES, isGoalDayKey, type Goal, type GoalMetric, type GoalStatus } from './Goal';

/**
 * Purpose: hydrate stored / backup JSON into Goal rows; drop unreadable members.
 * Inputs: unknown parsed JSON (array or junk).
 * Outputs: Goal[] (empty when the root is not an array).
 * Side effects: none.
 * Design decisions: missing goals in a v1 backup is a valid empty list, not a corrupt file.
 */
export function normalizeGoals(raw: unknown): Goal[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map(normalizeGoal).filter((item): item is Goal => item !== null);
}

/**
 * Purpose: coerce one unknown object into a Goal or drop it.
 * Inputs: unknown row.
 * Outputs: Goal or null.
 * Side effects: none.
 */
export function normalizeGoal(raw: unknown): Goal | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const value = raw as Record<string, unknown>;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const targetDate = typeof value.targetDate === 'string' ? value.targetDate.trim() : '';
  if (!id || !title || !isGoalDayKey(targetDate)) {
    return null;
  }
  const createdAt = typeof value.createdAt === 'string' && value.createdAt ? value.createdAt : new Date().toISOString();
  const updatedAt = typeof value.updatedAt === 'string' && value.updatedAt ? value.updatedAt : createdAt;
  const status = GOAL_STATUSES.includes(value.status as GoalStatus) ? (value.status as GoalStatus) : 'active';
  const why = typeof value.why === 'string' ? value.why : '';
  const metric = normalizeMetric(value.metric);
  const linkedReminderIds = uniqueIds(value.linkedReminderIds);
  const goal: Goal = {
    id,
    title,
    why,
    targetDate,
    linkedReminderIds,
    status,
    createdAt,
    updatedAt,
  };
  if (metric) {
    goal.metric = metric;
  }
  return goal;
}

function normalizeMetric(raw: unknown): GoalMetric | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const value = raw as Record<string, unknown>;
  const target = Number(value.target);
  const current = Number(value.current);
  if (!Number.isFinite(target)) {
    return undefined;
  }
  const unit = typeof value.unit === 'string' ? value.unit.trim() : '';
  return {
    target,
    current: Number.isFinite(current) ? current : 0,
    unit,
  };
}

function uniqueIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') {
      continue;
    }
    const id = item.trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  return ids;
}
