import { getDailyPrompt } from '../journal/prompts';

export interface LifeReflectionCue {
  reason: 'budget' | 'quiet';
  /** Catalog id from getDailyPrompt — View localizes `prompts.{promptId}`. */
  promptId: string;
  line: string;
}

const GENTLE_LINE = 'Want to add one line about today?';

/**
 * Purpose: surface a gentle cue only when the week is quiet late, or a budget is over.
 * Inputs: days written this week, whether any envelope is over, now.
 * Outputs: a cue or null (Today stays quiet when life is already moving).
 * Side effects: none.
 * Design decisions: one gentle line for both reasons; quiet only Thu–Sun so Mon–Wed silence is normal.
 */
export function suggestLifeReflection(
  daysWritten: number,
  budgetOver: boolean,
  now: Date = new Date(),
): LifeReflectionCue | null {
  const weekday = now.getDay();
  const lateWeek = weekday === 0 || weekday >= 4;
  const quietWeek = daysWritten === 0 && lateWeek;
  if (!budgetOver && !quietWeek) {
    return null;
  }
  return {
    reason: budgetOver ? 'budget' : 'quiet',
    promptId: getDailyPrompt(now),
    line: GENTLE_LINE,
  };
}
