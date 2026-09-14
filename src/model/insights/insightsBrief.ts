import type { InsightsGlanceTile, MonthlyBoardFacts, WeeklyBoardFacts } from './boardFacts';
import type { MonthlyInsightsReport } from './monthlyReport';
import type { InsightsPressure } from './pressure';
import { hrefForPressure } from './todaySummary';
import type { WeeklyInsightsReport } from './weeklyReport';

export { hrefForPressure };

/**
 * Purpose: one conclusion-first Insights fact (win or risk) — language-free.
 * Inputs: buildWeeklyInsightsBrief / buildMonthlyInsightsBrief.
 * Outputs: id + optional numeric value for View copy.
 * Side effects: none.
 */
export type InsightsBriefFactId =
  | 'writingDays'
  | 'habitHits'
  | 'spendDown'
  | 'spendUp'
  | 'worthUp'
  | 'worthDown'
  | 'overdue'
  | 'budgetOver'
  | 'habitThin'
  | 'writingThin';

export interface InsightsBriefFact {
  id: InsightsBriefFactId;
  value?: number;
}

/**
 * Purpose: Insights conclusion pack — summary pressure + key wins + key risks.
 * Inputs: buildWeeklyInsightsBrief / buildMonthlyInsightsBrief.
 * Outputs: pressure, wins, risks, suggested-action href. Charts stay in boardFacts.
 * Side effects: none.
 */
export interface InsightsBrief {
  pressure: InsightsPressure;
  wins: InsightsBriefFact[];
  risks: InsightsBriefFact[];
  actionHref: string;
}

const MAX_LIST = 3;

/**
 * Purpose: This week conclusion from the weekly report + glance tiles.
 * Inputs: WeeklyInsightsReport + WeeklyBoardFacts (already derived).
 * Outputs: InsightsBrief. Empty wins/risks arrays mean omit those sections.
 * Side effects: none.
 * Design decisions: wins need a real beat (delta up, high habit, spend down). Risks are
 *   overdue / envelope / thin writing / thin habits / spend jump. No invented mood charts.
 */
export function buildWeeklyInsightsBrief(
  report: WeeklyInsightsReport,
  board: WeeklyBoardFacts,
): InsightsBrief {
  const wins: InsightsBriefFact[] = [];
  const risks: InsightsBriefFact[] = [];
  pushWritingWin(wins, tileById(board.tiles, 'writingDays') ?? tileById(board.tiles, 'pages'), report.daysWritten);
  pushHabitWinOrRisk(wins, risks, tileById(board.tiles, 'habits'), report.habitHitRate);
  pushSpendWinOrRisk(wins, risks, tileById(board.tiles, 'spend'));
  if (report.remindersOverdue > 0) {
    risks.push({ id: 'overdue', value: report.remindersOverdue });
  }
  if (report.budgetOverCount > 0) {
    risks.push({ id: 'budgetOver', value: report.budgetOverCount });
  }
  if (report.pressure === 'writing' && report.daysWritten === 0) {
    risks.push({ id: 'writingThin' });
  }
  return {
    pressure: report.pressure,
    wins: wins.slice(0, MAX_LIST),
    risks: uniqueFacts(risks).slice(0, MAX_LIST),
    actionHref: hrefForPressure(report.pressure),
  };
}

/**
 * Purpose: This month conclusion from the monthly report + glance tiles.
 * Inputs: MonthlyInsightsReport + MonthlyBoardFacts.
 * Outputs: InsightsBrief.
 * Side effects: none.
 * Design decisions: worth tiles are month-only. Spend % comes from the report when the
 *   tile has no relative percent. Same omit-empty rule as the week brief.
 */
export function buildMonthlyInsightsBrief(
  report: MonthlyInsightsReport,
  board: MonthlyBoardFacts,
): InsightsBrief {
  const wins: InsightsBriefFact[] = [];
  const risks: InsightsBriefFact[] = [];
  pushWritingWin(wins, tileById(board.tiles, 'writingDays') ?? tileById(board.tiles, 'pages'), report.writingDays);
  pushHabitWinOrRisk(wins, risks, tileById(board.tiles, 'habits'), report.habitHitRate);
  const spendTile = tileById(board.tiles, 'spend');
  if (spendTile) {
    pushSpendWinOrRisk(wins, risks, spendTile);
  } else if (report.spendPercentChange !== null && report.spendPercentChange >= 20) {
    risks.push({ id: 'spendUp', value: Math.round(report.spendPercentChange) });
  } else if (report.spendPercentChange !== null && report.spendPercentChange < 0) {
    wins.push({ id: 'spendDown', value: Math.round(Math.abs(report.spendPercentChange)) });
  }
  const worthTile = tileById(board.tiles, 'worth');
  if (worthTile && worthTile.value !== null) {
    if (worthTile.value > 0) {
      wins.push({ id: 'worthUp' });
    } else if (worthTile.value < 0) {
      risks.push({ id: 'worthDown' });
    }
  }
  if (report.budgetOverCount > 0) {
    risks.push({ id: 'budgetOver', value: report.budgetOverCount });
  }
  if (report.pressure === 'writing' && report.writingDays < 3) {
    risks.push({ id: 'writingThin' });
  }
  return {
    pressure: report.pressure,
    wins: wins.slice(0, MAX_LIST),
    risks: uniqueFacts(risks).slice(0, MAX_LIST),
    actionHref: hrefForPressure(report.pressure),
  };
}

/**
 * Purpose: find one glance tile by id.
 * Inputs: tiles + id.
 * Outputs: tile or undefined.
 * Side effects: none.
 */
function tileById(tiles: InsightsGlanceTile[], id: InsightsGlanceTile['id']): InsightsGlanceTile | undefined {
  return tiles.find((tile) => tile.id === id);
}

/**
 * Purpose: writing win when vs-last is up, or a solid week/month of days.
 * Inputs: wins list, optional tile, current writing days.
 * Outputs: mutates wins.
 * Side effects: none (in-place list fill; caller owns the array).
 */
function pushWritingWin(
  wins: InsightsBriefFact[],
  tile: InsightsGlanceTile | undefined,
  daysWritten: number,
): void {
  if (tile?.delta && tile.delta.hasPrevious && tile.delta.delta > 0) {
    wins.push({ id: 'writingDays', value: tile.delta.delta });
    return;
  }
  if (daysWritten >= 3) {
    wins.push({ id: 'writingDays', value: daysWritten });
  }
}

/**
 * Purpose: habit win (≥65%) or thin-habit risk (<40%).
 * Inputs: wins, risks, optional habits tile, 0–1 rate.
 * Outputs: mutates lists.
 * Side effects: none.
 */
function pushHabitWinOrRisk(
  wins: InsightsBriefFact[],
  risks: InsightsBriefFact[],
  tile: InsightsGlanceTile | undefined,
  habitHitRate: number | null,
): void {
  const percent =
    tile?.value !== null && tile?.value !== undefined
      ? Math.round(tile.value)
      : habitHitRate !== null
        ? Math.round(habitHitRate * 100)
        : null;
  if (percent === null) {
    return;
  }
  if (percent >= 65) {
    wins.push({ id: 'habitHits', value: percent });
    return;
  }
  if (percent < 40) {
    risks.push({ id: 'habitThin', value: percent });
  }
}

/**
 * Purpose: spend down is a win; a ≥20% jump is a risk.
 * Inputs: wins, risks, spend tile.
 * Outputs: mutates lists.
 * Side effects: none.
 */
function pushSpendWinOrRisk(
  wins: InsightsBriefFact[],
  risks: InsightsBriefFact[],
  tile: InsightsGlanceTile | undefined,
): void {
  const delta = tile?.delta;
  if (!delta || !delta.hasPrevious) {
    return;
  }
  if (delta.delta < 0) {
    wins.push({ id: 'spendDown', value: Math.abs(delta.percent ?? delta.delta) });
    return;
  }
  if (delta.percent !== null && delta.percent >= 20) {
    risks.push({ id: 'spendUp', value: delta.percent });
  }
}

/**
 * Purpose: keep first occurrence of each fact id (overdue may arrive twice).
 * Inputs: facts in priority order.
 * Outputs: unique-by-id list.
 * Side effects: none.
 */
function uniqueFacts(facts: InsightsBriefFact[]): InsightsBriefFact[] {
  const seen = new Set<InsightsBriefFactId>();
  const out: InsightsBriefFact[] = [];
  for (const fact of facts) {
    if (seen.has(fact.id)) {
      continue;
    }
    seen.add(fact.id);
    out.push(fact);
  }
  return out;
}
