import type { Goal, GoalDraft, GoalStatus } from '../model/goals/Goal';
import { isGoalDraftValid } from '../model/goals/Goal';
import type { GoalRepository } from '../model/goals/GoalRepository';
import { createId } from '../utils/idUtils';

/**
 * Purpose: orchestrate on-device Goal CRUD without UI or progress math.
 * Inputs: GoalRepository plus drafts from the Focus editor.
 * Outputs: Goal snapshots.
 * Side effects: JSON persistence.
 * Design decisions: progress and “which Goal is on Today” stay in Model; this class only stores facts.
 */
export class GoalController {
  constructor(private readonly repository: GoalRepository) {}

  /**
   * Purpose: load Goals with active first, then soonest target date.
   * Inputs: none (repository load).
   * Outputs: Goal[] sorted for the Focus list.
   * Side effects: repository load.
   */
  async listGoals(): Promise<Goal[]> {
    const goals = await this.repository.loadAll();
    const rank: Record<GoalStatus, number> = { active: 0, paused: 1, done: 2 };
    return [...goals].sort((left, right) => {
      const byStatus = rank[left.status] - rank[right.status];
      if (byStatus !== 0) {
        return byStatus;
      }
      const byDate = left.targetDate.localeCompare(right.targetDate);
      if (byDate !== 0) {
        return byDate;
      }
      return right.updatedAt.localeCompare(left.updatedAt);
    });
  }

  /**
   * Purpose: persist a new Goal.
   * Inputs: GoalDraft from the editor.
   * Outputs: created Goal.
   * Side effects: repository save.
   */
  async createGoal(draft: GoalDraft): Promise<Goal> {
    const sanitized = sanitizeDraft(draft);
    const nowIso = new Date().toISOString();
    const goal: Goal = {
      id: createId(),
      ...sanitized,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const goals = await this.repository.loadAll();
    await this.repository.saveAll([goal, ...goals]);
    return goal;
  }

  /**
   * Purpose: replace fields on an existing Goal.
   * Inputs: id and GoalDraft.
   * Outputs: updated Goal.
   * Side effects: repository save.
   */
  async updateGoal(id: string, draft: GoalDraft): Promise<Goal> {
    const goals = await this.repository.loadAll();
    const existing = goals.find((item) => item.id === id);
    if (!existing) {
      throw new Error('Goal not found.');
    }
    const sanitized = sanitizeDraft(draft);
    const updated: Goal = {
      ...existing,
      ...sanitized,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    await this.repository.saveAll(goals.map((item) => (item.id === id ? updated : item)));
    return updated;
  }

  /**
   * Purpose: set status without rewriting the rest of the editor draft.
   * Inputs: id and GoalStatus.
   * Outputs: updated Goal.
   * Side effects: repository save.
   */
  async setStatus(id: string, status: GoalStatus): Promise<Goal> {
    const goals = await this.repository.loadAll();
    const existing = goals.find((item) => item.id === id);
    if (!existing) {
      throw new Error('Goal not found.');
    }
    const updated: Goal = { ...existing, status, updatedAt: new Date().toISOString() };
    await this.repository.saveAll(goals.map((item) => (item.id === id ? updated : item)));
    return updated;
  }

  /**
   * Purpose: remove a Goal. Linked reminders are left in place.
   * Inputs: id.
   * Outputs: void.
   * Side effects: repository save.
   */
  async deleteGoal(id: string): Promise<void> {
    const goals = await this.repository.loadAll();
    await this.repository.saveAll(goals.filter((item) => item.id !== id));
  }
}

/**
 * Purpose: trim copy, drop empty metric, keep unique reminder ids.
 * Inputs: GoalDraft.
 * Outputs: fields safe to persist.
 * Side effects: none.
 */
function sanitizeDraft(draft: GoalDraft): Omit<Goal, 'id' | 'createdAt' | 'updatedAt'> {
  if (!isGoalDraftValid(draft)) {
    throw new Error('Goal needs a title and a date.');
  }
  const metric = draft.metric
    ? {
        target: Number.isFinite(draft.metric.target) ? draft.metric.target : 0,
        current: Number.isFinite(draft.metric.current) ? Math.max(0, draft.metric.current) : 0,
        unit: draft.metric.unit.trim(),
      }
    : undefined;
  const seen = new Set<string>();
  const linkedReminderIds: string[] = [];
  for (const id of draft.linkedReminderIds) {
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    linkedReminderIds.push(trimmed);
  }
  return {
    title: draft.title.trim(),
    why: draft.why.trim(),
    targetDate: draft.targetDate,
    linkedReminderIds,
    status: draft.status,
    ...(metric ? { metric } : {}),
  };
}
