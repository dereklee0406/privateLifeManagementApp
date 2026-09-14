import type { Budget, BudgetProgress } from '../finance/Budget';
import type { Expense } from '../finance/Expense';
import { budgetProgressFor } from '../finance/financeStats';
import type { JournalEntry } from '../journal/JournalEntry';
import { computeWritingDaysInWindow } from '../journal/journalStats';
import type { Reminder } from '../reminders/Reminder';
import { computeOverallHabitRhythm } from '../reminders/habitStreaks';
import type { MoneyCurrency } from '../settings/AppSettings';
import { toDayKey } from '../../utils/dateUtils';

/**
 * Purpose: private mastery ranks — Spark (start) through Steel (hold). No XP or loot.
 */
export const SEASON_RANK_ORDER = ['spark', 'ember', 'forge', 'temper', 'steel'] as const;

export type SeasonRankId = (typeof SEASON_RANK_ORDER)[number];

/**
 * Purpose: inclusive lower bound for each rank (highest matching minScore wins).
 * Inputs: composite 0–1 score from writing + habit hit + budget discipline.
 * Outputs: rank table for tests and display.
 * Side effects: none.
 * Design decisions: five ranks along Spark → Forge → Steel. Thresholds are wide so a normal
 *   month lands on Forge/Temper, not a coin grind. Steel is rare on purpose.
 */
export const SEASON_RANK_TABLE: ReadonlyArray<{ id: SeasonRankId; minScore: number }> = [
  { id: 'steel', minScore: 0.85 },
  { id: 'temper', minScore: 0.65 },
  { id: 'forge', minScore: 0.4 },
  { id: 'ember', minScore: 0.2 },
  { id: 'spark', minScore: 0 },
];

export const SEASON_WINDOW_DAYS = 30;

/** Cheap week-over-week window for the Life Score trend (not a second Season engine). */
export const SEASON_TREND_DAYS = 7;

/**
 * Purpose: traffic-light status for one present Life Score pillar (not six numbers).
 * Inputs: pillarStatus().
 * Outputs: Good / Needs attention / Critical ids for View copy.
 * Side effects: none.
 */
export type PillarStatus = 'good' | 'attention' | 'critical';

/**
 * Purpose: Life Score week-over-week direction from two 0–1 composites.
 * Inputs: seasonTrendFromScores.
 * Outputs: up / down / flat.
 * Side effects: none.
 */
export type SeasonTrendDirection = 'up' | 'down' | 'flat';

/**
 * Purpose: compact week-over-week Life Score delta for Today.
 * Inputs: computeSeasonTrend / seasonTrendFromScores.
 * Outputs: 0–100 scores + signed points. Null when both scores are 0 (nothing to trend).
 * Side effects: none.
 */
export interface SeasonTrend {
  currentScore: number;
  previousScore: number;
  points: number;
  direction: SeasonTrendDirection;
}

/**
 * Purpose: derived Season snapshot — never persisted.
 * Inputs: computeSeasonRank.
 * Outputs: rank, 0–1 score, pillar rates, writing days, best habit streak (Today hero).
 * Side effects: none.
 */
export interface SeasonRank {
  rank: SeasonRankId;
  score: number;
  writingDays30: number;
  writingRate: number;
  habitHitRate: number | null;
  budgetDiscipline: number | null;
  bestCurrentStreak: number;
  windowDays: number;
}

/**
 * Purpose: map a 0–1 composite onto Spark…Steel.
 * Inputs: finite score (clamped).
 * Outputs: SeasonRankId.
 * Side effects: none.
 */
export function rankFromScore(score: number): SeasonRankId {
  const clamped = clamp01(score);
  for (const row of SEASON_RANK_TABLE) {
    if (clamped >= row.minScore) {
      return row.id;
    }
  }
  return 'spark';
}

/**
 * Purpose: Life Score points still needed to reach the next Season rank.
 * Inputs: composite 0–1 score (same as SeasonRank.score).
 * Outputs: next rank id + whole 0–100 points, or null at Steel (already max).
 * Side effects: none.
 * Design decisions: not XP. Floors come from SEASON_RANK_TABLE. Rounding matches the
 *   0–100 Life Score on Today. If rounding already equals the next floor but rankFromScore
 *   has not crossed it, show 1 pt so the line never reads “0 pts”.
 */
export interface SeasonRankNudge {
  nextRank: SeasonRankId;
  points: number;
}

/**
 * Purpose: compute the next-rank nudge from a 0–1 Season composite.
 * Inputs: finite score (clamped).
 * Outputs: SeasonRankNudge, or null at Steel.
 * Side effects: none.
 */
export function pointsToNextRank(score: number): SeasonRankNudge | null {
  const clamped = clamp01(score);
  const current = rankFromScore(clamped);
  if (current === 'steel') {
    return null;
  }
  const currentIndex = SEASON_RANK_TABLE.findIndex((row) => row.id === current);
  const next = currentIndex > 0 ? SEASON_RANK_TABLE[currentIndex - 1] : undefined;
  if (!next) {
    return null;
  }
  const currentPts = Math.round(clamped * 100);
  const nextPts = Math.round(next.minScore * 100);
  return {
    nextRank: next.id,
    points: Math.max(1, nextPts - currentPts),
  };
}

/**
 * Purpose: envelope discipline 0–1 from this month’s budget progress rows.
 * Inputs: budgetProgressFor() rows (current month, home currency).
 * Outputs: mean score, or null when there are no envelopes (pillar omitted).
 * Side effects: none.
 * Design decisions: overspent → 0. In-envelope floors at 0.55 so filling a budget is not Spark.
 *   Unused envelope (spent 0) → 1. Missing budgets do not invent a fake 50%.
 */
export function budgetDisciplineScore(progress: BudgetProgress[]): number | null {
  if (progress.length === 0) {
    return null;
  }
  let sum = 0;
  for (const row of progress) {
    sum += envelopeDiscipline(row.spent, row.budget.limit, row.over);
  }
  return sum / progress.length;
}

/**
 * Purpose: one Season pillar that is present (not a faked 50%).
 * Inputs: presentSeasonPillars.
 * Outputs: id + 0–1 rate for View bars.
 * Side effects: none.
 */
export type SeasonPillarId = 'writing' | 'habits' | 'budget';

export interface SeasonPillar {
  id: SeasonPillarId;
  rate: number;
}

/**
 * Purpose: writing / habits / budget bars for Insights hero — omit missing pillars.
 * Inputs: SeasonRank rates (writing always; habit/budget null when that domain is empty).
 * Outputs: 1–3 pillars, writing first. Rates clamped 0–1.
 * Side effects: none.
 * Design decisions: same omit-don’t-fake rule as compositeSeasonScore. View must not invent
 *   a grey “empty” envelope bar when there are no budgets.
 */
export function presentSeasonPillars(
  season: Pick<SeasonRank, 'writingRate' | 'habitHitRate' | 'budgetDiscipline'>,
): SeasonPillar[] {
  const pillars: SeasonPillar[] = [{ id: 'writing', rate: clamp01(season.writingRate) }];
  if (season.habitHitRate !== null) {
    pillars.push({ id: 'habits', rate: clamp01(season.habitHitRate) });
  }
  if (season.budgetDiscipline !== null) {
    pillars.push({ id: 'budget', rate: clamp01(season.budgetDiscipline) });
  }
  return pillars;
}

/**
 * Purpose: map a 0–1 pillar rate onto Good / Needs attention / Critical.
 * Inputs: finite rate (clamped).
 * Outputs: PillarStatus.
 * Side effects: none.
 * Design decisions: floors match Season ranks — Temper (0.65) is Good, Forge (0.4) is
 *   Needs attention, below Forge is Critical. Missing pillars are omitted by the caller.
 */
export function pillarStatus(rate: number): PillarStatus {
  const clamped = clamp01(rate);
  if (clamped >= 0.65) {
    return 'good';
  }
  if (clamped >= 0.4) {
    return 'attention';
  }
  return 'critical';
}

/**
 * Purpose: 0–100 week-over-week Life Score delta, or null when both scores are empty.
 * Inputs: current and previous 0–1 composites.
 * Outputs: SeasonTrend or null.
 * Side effects: none.
 * Design decisions: rounding happens once here so View does not invent a phantom +1.
 */
export function seasonTrendFromScores(current01: number, previous01: number): SeasonTrend | null {
  const currentScore = Math.round(clamp01(current01) * 100);
  const previousScore = Math.round(clamp01(previous01) * 100);
  if (currentScore === 0 && previousScore === 0) {
    return null;
  }
  const points = currentScore - previousScore;
  const direction: SeasonTrendDirection = points > 0 ? 'up' : points < 0 ? 'down' : 'flat';
  return { currentScore, previousScore, points, direction };
}

/**
 * Purpose: derive Life Score trend by recomputing Season 7 days ago (cheap, same math).
 * Inputs: same as computeSeasonRank.
 * Outputs: SeasonTrend or null.
 * Side effects: none.
 * Design decisions: reuse computeSeasonRank with now − 7 local days. No extra stats store.
 */
export function computeSeasonTrend(
  entries: JournalEntry[],
  reminders: Reminder[],
  budgets: Budget[],
  expenses: Expense[],
  currency: MoneyCurrency,
  now: Date = new Date(),
): SeasonTrend | null {
  const current = computeSeasonRank(entries, reminders, budgets, expenses, currency, now);
  const weekAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - SEASON_TREND_DAYS,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  );
  const previous = computeSeasonRank(entries, reminders, budgets, expenses, currency, weekAgo);
  return seasonTrendFromScores(current.score, previous.score);
}

/**
 * Purpose: equal-weight mean of present pillars (skip nulls).
 * Inputs: writing rate always; habit / budget null when that domain is empty.
 * Outputs: 0–1. No pillars (should not happen — writing rate is always present) → 0.
 * Side effects: none.
 */
export function compositeSeasonScore(
  writingRate: number,
  habitHitRate: number | null,
  budgetDiscipline: number | null,
): number {
  const parts = [clamp01(writingRate)];
  if (habitHitRate !== null) {
    parts.push(clamp01(habitHitRate));
  }
  if (budgetDiscipline !== null) {
    parts.push(clamp01(budgetDiscipline));
  }
  if (parts.length === 0) {
    return 0;
  }
  return parts.reduce((total, part) => total + part, 0) / parts.length;
}

/**
 * Purpose: derive Season from 30-day writing days, habit hit rate, and budget discipline.
 * Inputs: journal entries, reminders, budgets, expenses, home currency, now.
 * Outputs: SeasonRank (pure; not stored).
 * Side effects: none.
 * Design decisions: writing always contributes (0/30 is a real Spark). Habits use the existing
 *   30-day overall consistency. Budgets are this calendar month’s envelopes via budgetProgressFor.
 *   No XP, coins, or avatars. Rank is not persisted.
 */
export function computeSeasonRank(
  entries: JournalEntry[],
  reminders: Reminder[],
  budgets: Budget[],
  expenses: Expense[],
  currency: MoneyCurrency,
  now: Date = new Date(),
): SeasonRank {
  const writingDays30 = computeWritingDaysInWindow(entries, now, SEASON_WINDOW_DAYS);
  const writingRate = writingDays30 / SEASON_WINDOW_DAYS;
  const todayKey = toDayKey(now);
  const rhythm = computeOverallHabitRhythm(reminders, todayKey);
  const habitHitRate = rhythm.activeHabitCount > 0 ? rhythm.overallConsistency30Days : null;
  const budgetProgress = budgetProgressFor(budgets, expenses, now.getFullYear(), now.getMonth(), currency);
  const budgetDiscipline = budgetDisciplineScore(budgetProgress);
  const score = compositeSeasonScore(writingRate, habitHitRate, budgetDiscipline);
  return {
    rank: rankFromScore(score),
    score,
    writingDays30,
    writingRate,
    habitHitRate,
    budgetDiscipline,
    bestCurrentStreak: rhythm.bestCurrentStreak,
    windowDays: SEASON_WINDOW_DAYS,
  };
}

/**
 * Purpose: one envelope’s discipline score.
 * Inputs: spent, limit, over flag from BudgetProgress.
 * Outputs: 0–1.
 * Side effects: none.
 */
function envelopeDiscipline(spent: number, limit: number, over: boolean): number {
  if (over) {
    return 0;
  }
  if (!Number.isFinite(limit) || limit <= 0) {
    return spent > 0 ? 0 : 1;
  }
  const used = clamp01(spent / limit);
  return 0.55 + 0.45 * (1 - used);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}
