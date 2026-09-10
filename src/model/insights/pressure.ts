/**
 * Purpose: one pressure kind for Insights week / month copy (rule-based, no LLM).
 * Inputs: pickWeeklyPressure / pickMonthlyPressure.
 * Outputs: catalog key suffix via View (`insights.pressure*`).
 * Side effects: none.
 * Design decisions: one line, not a dashboard of alerts. Priority is the thing that needs a tap.
 */
export type InsightsPressure =
  | 'quiet'
  | 'overdue'
  | 'budget'
  | 'writing'
  | 'habits'
  | 'spendUp'
  | 'worth'
  | 'steady';

export interface WeeklyPressureInput {
  daysWritten: number;
  pageCount: number;
  spendTotal: number;
  remindersCompleted: number;
  remindersOverdue: number;
  habitHitRate: number | null;
  budgetOverCount: number;
}

export interface MonthlyPressureInput {
  dayOfMonth: number;
  writingDays: number;
  pageCount: number;
  spent: number;
  spendPercentChange: number | null;
  habitHitRate: number | null;
  budgetOverCount: number;
  netWorthDelta: number | undefined;
}

/**
 * Purpose: pick This week’s single pressure line.
 * Inputs: weekly counts + optional habit rate.
 * Outputs: InsightsPressure.
 * Side effects: none.
 * Design decisions: overdue and overspent envelopes beat “write more”. Quiet is empty week, not a miss.
 */
export function pickWeeklyPressure(input: WeeklyPressureInput): InsightsPressure {
  if (input.remindersOverdue > 0) {
    return 'overdue';
  }
  if (input.budgetOverCount > 0) {
    return 'budget';
  }
  if (input.habitHitRate !== null && input.habitHitRate < 0.4) {
    return 'habits';
  }
  const emptyLog = input.pageCount === 0 && input.spendTotal === 0 && input.remindersCompleted === 0;
  if (emptyLog) {
    return 'quiet';
  }
  if (input.daysWritten === 0) {
    return 'writing';
  }
  return 'steady';
}

/**
 * Purpose: pick This month’s single pressure line (board-pack, not wellness).
 * Inputs: month-to-date facts.
 * Outputs: InsightsPressure.
 * Side effects: none.
 * Design decisions: envelope break and a ≥20% spend jump vs last month come first. Thin writing
 *   waits until the 10th so day-2 silence is not a scold. Net-worth slip is last among real hits.
 */
export function pickMonthlyPressure(input: MonthlyPressureInput): InsightsPressure {
  if (input.budgetOverCount > 0) {
    return 'budget';
  }
  if (input.spendPercentChange !== null && input.spendPercentChange >= 20) {
    return 'spendUp';
  }
  const thinWriting =
    input.writingDays === 0 || (input.dayOfMonth >= 10 && input.writingDays < 3);
  if (thinWriting && (input.pageCount === 0 || input.dayOfMonth >= 10)) {
    return 'writing';
  }
  if (input.habitHitRate !== null && input.habitHitRate < 0.4) {
    return 'habits';
  }
  if (input.netWorthDelta !== undefined && input.netWorthDelta < 0) {
    return 'worth';
  }
  if (input.pageCount === 0 && input.spent === 0) {
    return 'quiet';
  }
  return 'steady';
}
