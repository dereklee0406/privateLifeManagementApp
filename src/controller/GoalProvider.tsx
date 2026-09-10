import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { GoalController } from './GoalController';
import { GoalsLocalStore } from '../data/GoalsLocalStore';
import type { Goal, GoalDraft, GoalStatus } from '../model/goals/Goal';

interface GoalContextValue {
  ready: boolean;
  goals: Goal[];
  createGoal: (draft: GoalDraft) => Promise<Goal>;
  updateGoal: (id: string, draft: GoalDraft) => Promise<Goal>;
  setStatus: (id: string, status: GoalStatus) => Promise<Goal>;
  deleteGoal: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const GoalContext = createContext<GoalContextValue | null>(null);

/**
 * Purpose: bind GoalController to React.
 * Inputs: children tree.
 * Outputs: Goal list and mutators.
 * Side effects: loads and writes Goals JSON.
 * Design decisions: progress math stays in Model; this provider only persists and refreshes.
 */
export function GoalProvider({ children }: { children: ReactNode }) {
  const controller = useMemo(() => new GoalController(new GoalsLocalStore()), []);
  const [ready, setReady] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);

  const refresh = async () => {
    const next = await controller.listGoals();
    setGoals(next);
    setReady(true);
  };

  useEffect(() => {
    void refresh();
  }, [controller]);

  const value = useMemo<GoalContextValue>(
    () => ({
      ready,
      goals,
      createGoal: async (draft) => {
        const created = await controller.createGoal(draft);
        await refresh();
        return created;
      },
      updateGoal: async (id, draft) => {
        const updated = await controller.updateGoal(id, draft);
        await refresh();
        return updated;
      },
      setStatus: async (id, status) => {
        const updated = await controller.setStatus(id, status);
        await refresh();
        return updated;
      },
      deleteGoal: async (id) => {
        await controller.deleteGoal(id);
        await refresh();
      },
      refresh,
    }),
    [ready, goals, controller],
  );

  return createElement(GoalContext.Provider, { value }, children);
}

/**
 * Purpose: access Goal use cases from views.
 */
export function useGoals(): GoalContextValue {
  const value = useContext(GoalContext);
  if (!value) {
    throw new Error('useGoals must be used inside GoalProvider.');
  }
  return value;
}
