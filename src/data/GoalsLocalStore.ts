import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppConfig } from '../config/appConfig';
import type { Goal } from '../model/goals/Goal';
import type { GoalRepository } from '../model/goals/GoalRepository';
import { normalizeGoals } from '../model/goals/normalizeGoal';

/**
 * Purpose: persist Goals as one JSON array (not PIN / not reminders).
 * Inputs: Goal[].
 * Outputs: loaded Goal rows.
 * Side effects: AsyncStorage read/write.
 * Design decisions: empty or corrupt keys become []; never seed sample aims.
 */
export class GoalsLocalStore implements GoalRepository {
  /**
   * Purpose: load Goals; missing or unreadable documents are an empty list.
   */
  async loadAll(): Promise<Goal[]> {
    const raw = await AsyncStorage.getItem(AppConfig.storage.goalsKey);
    if (!raw) {
      return [];
    }
    try {
      return normalizeGoals(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  /**
   * Purpose: replace the stored Goals document.
   */
  async saveAll(goals: Goal[]): Promise<void> {
    await AsyncStorage.setItem(AppConfig.storage.goalsKey, JSON.stringify(goals));
  }
}
