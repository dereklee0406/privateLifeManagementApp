import type { Goal } from './Goal';

/**
 * Purpose: persistence port for on-device Goals.
 * Inputs / outputs: Goal arrays.
 * Side effects: implemented by the data layer.
 * Design decisions: interface lives in Model so GoalController stays testable without AsyncStorage.
 */
export interface GoalRepository {
  loadAll(): Promise<Goal[]>;
  saveAll(goals: Goal[]): Promise<void>;
}
