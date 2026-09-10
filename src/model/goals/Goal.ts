/**
 * Purpose: a personal aim with an optional number and linked habits — not a reminder kind.
 * Inputs: GoalController create/update; Focus editor.
 * Outputs: JSON-serializable row for on-device storage and backup.
 * Side effects: none.
 * Design decisions: reminders stay the task engine; a Goal may point at reminder IDs.
 *   Progress is derived in goalProgress.ts, never stored. No Season / XP fields.
 */

export type GoalStatus = 'active' | 'paused' | 'done';

export const GOAL_STATUSES: GoalStatus[] = ['active', 'paused', 'done'];

/**
 * Purpose: optional countable progress toward the aim (km, pages, HKD, …).
 * Inputs: Focus editor metric fields.
 * Outputs: stored on Goal when the writer opts in.
 * Side effects: none.
 */
export interface GoalMetric {
  target: number;
  current: number;
  unit: string;
}

/**
 * Purpose: persisted Goal row.
 * Inputs: GoalController.
 * Outputs: JSON document member.
 * Side effects: none.
 */
export interface Goal {
  id: string;
  title: string;
  why: string;
  /** Civil target day YYYY-MM-DD (local). */
  targetDate: string;
  metric?: GoalMetric;
  linkedReminderIds: string[];
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Purpose: editor payload without persistence timestamps.
 * Inputs: GoalEditScreen.
 * Outputs: GoalController create/update.
 * Side effects: none.
 */
export interface GoalDraft {
  title: string;
  why: string;
  targetDate: string;
  metric?: GoalMetric;
  linkedReminderIds: string[];
  status: GoalStatus;
}

/**
 * Purpose: YYYY-MM-DD ninety local days from `now` (default new Goal target).
 * Inputs: reference Date.
 * Outputs: day key.
 * Side effects: none.
 */
export function defaultGoalTargetDate(now: Date = new Date()): string {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 90, 12, 0, 0, 0);
  const year = day.getFullYear();
  const month = String(day.getMonth() + 1).padStart(2, '0');
  const date = String(day.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

/**
 * Purpose: empty draft for the create form.
 * Inputs: optional now for the default target date.
 * Outputs: GoalDraft (active, no metric, no links).
 * Side effects: none.
 */
export function blankGoalDraft(now: Date = new Date()): GoalDraft {
  return {
    title: '',
    why: '',
    targetDate: defaultGoalTargetDate(now),
    linkedReminderIds: [],
    status: 'active',
  };
}

/**
 * Purpose: map a stored Goal back into the editor.
 * Inputs: Goal row.
 * Outputs: GoalDraft.
 * Side effects: none.
 */
export function goalToDraft(goal: Goal): GoalDraft {
  return {
    title: goal.title,
    why: goal.why,
    targetDate: goal.targetDate,
    metric: goal.metric ? { ...goal.metric } : undefined,
    linkedReminderIds: [...goal.linkedReminderIds],
    status: goal.status,
  };
}

/**
 * Purpose: whether the editor can persist (title + valid target day).
 * Inputs: GoalDraft.
 * Outputs: true when title is non-empty after trim and targetDate is YYYY-MM-DD.
 * Side effects: none.
 */
export function isGoalDraftValid(draft: GoalDraft): boolean {
  return draft.title.trim().length > 0 && isGoalDayKey(draft.targetDate);
}

/**
 * Purpose: civil day-key shape used by Goal target dates.
 * Inputs: unknown string.
 * Outputs: true for YYYY-MM-DD.
 * Side effects: none.
 */
export function isGoalDayKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
