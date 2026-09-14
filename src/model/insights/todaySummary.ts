import type { InsightsPressure } from './pressure';
import type { TodayPrediction } from './predictions';

/**
 * Purpose: at most three rule-based Today summary lines (not a coach essay, not an LLM).
 * Inputs: buildTodaySummary.
 * Outputs: language-free facts. View localizes. Empty array → omit the block.
 * Side effects: none.
 */
export type TodaySummaryKind = 'pressure' | 'prediction' | 'writingDays' | 'habitHits';

export type TodaySummaryLine =
  | { kind: 'pressure'; pressure: InsightsPressure; href: string }
  | { kind: 'prediction'; prediction: TodayPrediction }
  | { kind: 'writingDays'; days: number }
  | { kind: 'habitHits'; percent: number };

export interface TodaySummaryInput {
  pressure: InsightsPressure;
  prediction: TodayPrediction | null;
  daysWritten: number;
  habitHitRate: number | null;
}

const MAX_LINES = 3;

const ACTIONABLE_PRESSURE: ReadonlySet<InsightsPressure> = new Set([
  'overdue',
  'budget',
  'writing',
  'habits',
  'spendUp',
  'worth',
]);

/**
 * Purpose: hub href for a pressure kind (shared with Insights conclusion).
 * Inputs: InsightsPressure.
 * Outputs: in-app path. Writing/quiet → Journal; overdue/habits → Focus; money → Wallet.
 * Side effects: none.
 */
export function hrefForPressure(pressure: InsightsPressure): string {
  if (pressure === 'overdue') {
    return '/(tabs)/calendar?tab=tasks';
  }
  if (pressure === 'habits') {
    return '/(tabs)/calendar?tab=streaks';
  }
  if (pressure === 'budget' || pressure === 'spendUp') {
    return '/(tabs)/money?segment=cashflow';
  }
  if (pressure === 'worth') {
    return '/(tabs)/money?segment=worth';
  }
  if (pressure === 'writing' || pressure === 'quiet') {
    return '/(tabs)/journal';
  }
  return '/(tabs)';
}

/**
 * Purpose: pick at most three Today summary lines from pressure, prediction, and week facts.
 * Inputs: weekly pressure, optional prediction, writing/habit/spend counts.
 * Outputs: 0–3 TodaySummaryLine. Empty when there is nothing true to say.
 * Side effects: none.
 * Design decisions: skip quiet/steady essays. Skip a prediction that restates the pressure
 *   (due vs overdue, writing vs writing, pace vs budget). Do not invent spend copy without
 *   a View-formatted amount — spend stays on Wallet / Insights. Cap is hard.
 */
export function buildTodaySummary(input: TodaySummaryInput): TodaySummaryLine[] {
  const lines: TodaySummaryLine[] = [];

  if (ACTIONABLE_PRESSURE.has(input.pressure)) {
    lines.push({
      kind: 'pressure',
      pressure: input.pressure,
      href: hrefForPressure(input.pressure),
    });
  }

  if (input.prediction && !predictionDuplicatesPressure(input.prediction, input.pressure)) {
    lines.push({ kind: 'prediction', prediction: input.prediction });
  }

  if (input.daysWritten > 0) {
    lines.push({ kind: 'writingDays', days: input.daysWritten });
  } else if (input.habitHitRate !== null) {
    lines.push({ kind: 'habitHits', percent: Math.round(input.habitHitRate * 100) });
  }

  return lines.slice(0, MAX_LINES);
}

/**
 * Purpose: drop a prediction that would reprint the pressure line.
 * Inputs: prediction + pressure.
 * Outputs: true when the second line would be the same beat.
 * Side effects: none.
 */
function predictionDuplicatesPressure(
  prediction: TodayPrediction,
  pressure: InsightsPressure,
): boolean {
  if (prediction.kind === 'due' && pressure === 'overdue') {
    return true;
  }
  if (prediction.kind === 'writing' && pressure === 'writing') {
    return true;
  }
  if (prediction.kind === 'pace' && pressure === 'budget') {
    return true;
  }
  if (prediction.kind === 'renewal' && (pressure === 'budget' || pressure === 'spendUp')) {
    return true;
  }
  return false;
}
