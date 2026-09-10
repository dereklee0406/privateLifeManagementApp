import type { Expense } from '../finance/Expense';
import type { JournalEntry } from '../journal/JournalEntry';
import type { Reminder } from '../reminders/Reminder';
import { habitHitRateBetween } from '../reminders/habitStreaks';
import type { MoneyCurrency, WeekStart } from '../settings/AppSettings';
import { toDayKey } from '../../utils/dateUtils';
import { alignedPreviousWeekSoFar, startOfWeek } from '../life/weekBounds';
import { spendInDayRange } from '../today/todayGlance';
import type { MonthlyInsightsReport } from './monthlyReport';
import type { WeeklyInsightsReport } from './weeklyReport';

/**
 * Purpose: current vs previous period for one Insights glance tile.
 * Inputs: comparePeriod / compareRates.
 * Outputs: language-free counts; View localizes the delta line.
 * Side effects: none.
 */
export interface PeriodDelta {
  current: number;
  previous: number;
  delta: number;
  /** Relative % vs previous when previous ≠ 0; null for points-only or no baseline. */
  percent: number | null;
  hasPrevious: boolean;
}

export type InsightsTileId = 'pages' | 'writingDays' | 'habits' | 'spend' | 'worth';
export type InsightsTileUnit = 'count' | 'percent' | 'money';
export type InsightsDeltaFlavor = 'moreIsGood' | 'moreIsBad';

/**
 * Purpose: one board-pack glance cell — number + vs-last, no list reprint.
 * Inputs: computeWeeklyBoardFacts / computeMonthlyBoardFacts.
 * Outputs: presentation facts. `value` null means the domain is missing (invite, don’t fake).
 * Side effects: none.
 */
export interface InsightsGlanceTile {
  id: InsightsTileId;
  value: number | null;
  unit: InsightsTileUnit;
  currency?: MoneyCurrency;
  delta: PeriodDelta | null;
  flavor: InsightsDeltaFlavor;
}

/**
 * Purpose: one civil day in the Insights week strip (writing fill + optional habit pip).
 * Inputs: weekActivityStrip.
 * Outputs: flags for View cells. Future days stay empty, not guessed.
 * Side effects: none.
 */
export interface WeekStripCell {
  dayKey: string;
  wrote: boolean;
  habitHit: boolean;
  isToday: boolean;
  isFuture: boolean;
}

/**
 * Purpose: month writing pace vs elapsed days (a page-a-day yardstick, not a goal engine).
 * Inputs: monthWritingPace.
 * Outputs: counts + 0–1 ratio for a View bar.
 * Side effects: none.
 */
export interface MonthPace {
  writingDays: number;
  elapsedDays: number;
  daysInMonth: number;
  ratio: number;
}

/**
 * Purpose: This week board pack — glance tiles + 7-cell strip + sparse flag.
 * Inputs: computeWeeklyBoardFacts.
 * Outputs: language-free facts. Pressure stays on WeeklyInsightsReport.
 * Side effects: none.
 */
export interface WeeklyBoardFacts {
  tiles: InsightsGlanceTile[];
  strip: WeekStripCell[];
  sparse: boolean;
}

/**
 * Purpose: This month board pack — glance tiles + writing pace + sparse flag.
 * Inputs: computeMonthlyBoardFacts.
 * Outputs: language-free facts. Pressure stays on MonthlyInsightsReport.
 * Side effects: none.
 */
export interface MonthlyBoardFacts {
  tiles: InsightsGlanceTile[];
  pace: MonthPace;
  sparse: boolean;
}

/**
 * Purpose: signed difference with optional relative percent.
 * Inputs: current, previous, whether a real previous period exists (not a ghost zero).
 * Outputs: PeriodDelta. percent is null when previous is 0.
 * Side effects: none.
 * Design decisions: first-week zeros are not “+0 vs last.” hasPrevious is previous > 0 so
 *   View can show “First stretch” instead of a fake beat.
 */
export function comparePeriod(current: number, previous: number, hasPrevious: boolean): PeriodDelta {
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const safePrevious = Number.isFinite(previous) ? previous : 0;
  const delta = safeCurrent - safePrevious;
  const percent =
    hasPrevious && safePrevious !== 0 ? Math.round((delta / Math.abs(safePrevious)) * 100) : null;
  return {
    current: safeCurrent,
    previous: safePrevious,
    delta,
    percent,
    hasPrevious,
  };
}

/**
 * Purpose: habit-hit comparison in percentage points (not percent-of-percent).
 * Inputs: current / previous 0–1 rates; null when that domain is empty.
 * Outputs: PeriodDelta in 0–100 points, or null when there is no current habit domain.
 * Side effects: none.
 * Design decisions: missing habits are omitted (tile invite), not a faked 0%. percent stays
 *   null so View prints “+12 vs last” as points under an already-% number.
 */
export function compareRates(current: number | null, previous: number | null): PeriodDelta | null {
  if (current === null) {
    return null;
  }
  const hasPrevious = previous !== null;
  const cur = Math.round(clamp01(current) * 100);
  const prev = Math.round(clamp01(previous ?? 0) * 100);
  return {
    current: cur,
    previous: prev,
    delta: cur - prev,
    percent: null,
    hasPrevious,
  };
}

/**
 * Purpose: pages whose civil createdAt sits in an inclusive YYYY-MM-DD window.
 * Inputs: journal entries, start/end keys.
 * Outputs: count (several pages on one day still count separately).
 * Side effects: none.
 */
export function pageCountBetween(entries: JournalEntry[], startKey: string, endKey: string): number {
  let count = 0;
  for (const entry of entries) {
    const key = toDayKey(new Date(entry.createdAt));
    if (key >= startKey && key <= endKey) {
      count += 1;
    }
  }
  return count;
}

/**
 * Purpose: distinct civil days with at least one page in an inclusive window.
 * Inputs: journal entries, start/end keys.
 * Outputs: integer day count.
 * Side effects: none.
 */
export function writingDaysBetween(entries: JournalEntry[], startKey: string, endKey: string): number {
  const days = new Set<string>();
  for (const entry of entries) {
    const key = toDayKey(new Date(entry.createdAt));
    if (key >= startKey && key <= endKey) {
      days.add(key);
    }
  }
  return days.size;
}

/**
 * Purpose: previous calendar month, 1st through the same day-of-month (clamped).
 * Inputs: now.
 * Outputs: inclusive start/end YYYY-MM-DD keys.
 * Side effects: none.
 * Design decisions: 31 Jan vs February clamps to Feb 28/29 so Insights does not invent days.
 */
export function alignedPreviousMonthSoFar(now: Date): { startKey: string; endKey: string } {
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDay = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate();
  const day = Math.min(now.getDate(), lastDay);
  const end = new Date(prev.getFullYear(), prev.getMonth(), day);
  return { startKey: toDayKey(prev), endKey: toDayKey(end) };
}

/**
 * Purpose: 7-cell week texture — wrote fill + habit pip; future cells stay empty.
 * Inputs: entries, reminders, now, week start (same as Calendar / This week).
 * Outputs: Monday-or-Sunday-first cells.
 * Side effects: none.
 * Design decisions: a pip is “any active habit checked that day,” not a per-habit list.
 *   No habits → habitHit stays false (View hides pips). Not a Rhythm heatmap reprint.
 */
export function weekActivityStrip(
  entries: JournalEntry[],
  reminders: Reminder[],
  now: Date,
  weekStartsOn: WeekStart = 'monday',
): WeekStripCell[] {
  const start = startOfWeek(now, weekStartsOn);
  const todayKey = toDayKey(now);
  const wrote = new Set(entries.map((entry) => toDayKey(new Date(entry.createdAt))));
  const habits = reminders.filter(isActiveRecurringHabit);
  const habitDays = new Set<string>();
  for (const habit of habits) {
    for (const key of habit.completedDayKeys ?? []) {
      habitDays.add(key);
    }
  }
  const cells: WeekStripCell[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
    const dayKey = toDayKey(date);
    cells.push({
      dayKey,
      wrote: wrote.has(dayKey),
      habitHit: habits.length > 0 && habitDays.has(dayKey),
      isToday: dayKey === todayKey,
      isFuture: dayKey > todayKey,
    });
  }
  return cells;
}

/**
 * Purpose: writing days vs elapsed days this month (pace bar, not a streak list).
 * Inputs: writingDays from monthly report, now.
 * Outputs: MonthPace; ratio capped at 1.
 * Side effects: none.
 * Design decisions: yardstick is one writing day per elapsed day. Over-pace still fills the bar.
 */
export function monthWritingPace(writingDays: number, now: Date): MonthPace {
  const elapsedDays = Math.max(1, now.getDate());
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const safeDays = Number.isFinite(writingDays) && writingDays > 0 ? writingDays : 0;
  return {
    writingDays: safeDays,
    elapsedDays,
    daysInMonth,
    ratio: Math.min(1, safeDays / elapsedDays),
  };
}

/**
 * Purpose: This week glance tiles + strip from the weekly report plus aligned last week.
 * Inputs: current WeeklyInsightsReport, same sources used to build it, now, week start.
 * Outputs: WeeklyBoardFacts (pure).
 * Side effects: none.
 * Design decisions: vs-last uses alignedPreviousWeekSoFar so Wednesday is not punished vs
 *   last week’s seven days. Spend last-week is the same window. Sparse = no pages, no spend,
 *   and no habit domain or a 0% hit — View still draws the board and invites Write/Habit/Spend.
 */
export function computeWeeklyBoardFacts(
  report: WeeklyInsightsReport,
  entries: JournalEntry[],
  expenses: Expense[],
  reminders: Reminder[],
  now: Date,
  weekStartsOn: WeekStart = 'monday',
): WeeklyBoardFacts {
  const previous = alignedPreviousWeekSoFar(now, weekStartsOn);
  const lastPages = pageCountBetween(entries, previous.startKey, previous.endKey);
  const lastDays = writingDaysBetween(entries, previous.startKey, previous.endKey);
  const lastSpend = spendInDayRange(expenses, report.currency, previous.startKey, previous.endKey);
  const lastHabits = habitHitRateBetween(reminders, previous.startKey, previous.endKey);
  const habitDelta = compareRates(report.habitHitRate, lastHabits.rate);
  const tiles: InsightsGlanceTile[] = [
    {
      id: 'pages',
      value: report.pageCount,
      unit: 'count',
      delta: comparePeriod(report.pageCount, lastPages, lastPages > 0),
      flavor: 'moreIsGood',
    },
    {
      id: 'writingDays',
      value: report.daysWritten,
      unit: 'count',
      delta: comparePeriod(report.daysWritten, lastDays, lastDays > 0),
      flavor: 'moreIsGood',
    },
    {
      id: 'habits',
      value: report.habitHitRate === null ? null : Math.round(report.habitHitRate * 100),
      unit: 'percent',
      delta: habitDelta,
      flavor: 'moreIsGood',
    },
    {
      id: 'spend',
      value: report.spendTotal,
      unit: 'money',
      currency: report.currency,
      delta: comparePeriod(report.spendTotal, lastSpend, lastSpend > 0),
      flavor: 'moreIsBad',
    },
  ];
  return {
    tiles,
    strip: weekActivityStrip(entries, reminders, now, weekStartsOn),
    sparse: isWeekSparse(report),
  };
}

/**
 * Purpose: This month glance tiles + writing pace from the monthly report plus aligned last month.
 * Inputs: current MonthlyInsightsReport, journal/reminders for aligned writing/habit, now.
 * Outputs: MonthlyBoardFacts (pure).
 * Side effects: none.
 * Design decisions: spend vs last month reuses the report (full previous month, same as the
 *   takeaway). Pages / writing days / habits use aligned month-to-date so the 12th is not
 *   scored against all of last month. Worth tile is the snapshot delta, omitted when missing.
 */
export function computeMonthlyBoardFacts(
  report: MonthlyInsightsReport,
  entries: JournalEntry[],
  reminders: Reminder[],
  now: Date,
): MonthlyBoardFacts {
  const previous = alignedPreviousMonthSoFar(now);
  const lastPages = pageCountBetween(entries, previous.startKey, previous.endKey);
  const lastDays = writingDaysBetween(entries, previous.startKey, previous.endKey);
  const lastHabits = habitHitRateBetween(reminders, previous.startKey, previous.endKey);
  const habitDelta = compareRates(report.habitHitRate, lastHabits.rate);
  const spendBase = comparePeriod(report.spent, report.previousSpent, report.hasPreviousSpend);
  const spendDelta: PeriodDelta = {
    ...spendBase,
    percent: report.spendPercentChange ?? spendBase.percent,
  };
  const tiles: InsightsGlanceTile[] = [
    {
      id: 'pages',
      value: report.pageCount,
      unit: 'count',
      delta: comparePeriod(report.pageCount, lastPages, lastPages > 0),
      flavor: 'moreIsGood',
    },
    {
      id: 'writingDays',
      value: report.writingDays,
      unit: 'count',
      delta: comparePeriod(report.writingDays, lastDays, lastDays > 0),
      flavor: 'moreIsGood',
    },
    {
      id: 'habits',
      value: report.habitHitRate === null ? null : Math.round(report.habitHitRate * 100),
      unit: 'percent',
      delta: habitDelta,
      flavor: 'moreIsGood',
    },
    {
      id: 'spend',
      value: report.spent,
      unit: 'money',
      currency: report.currency,
      delta: spendDelta,
      flavor: 'moreIsBad',
    },
    {
      id: 'worth',
      value: report.hasNetWorthSnapshot ? (report.netWorthDelta ?? 0) : null,
      unit: 'money',
      currency: report.currency,
      delta: null,
      flavor: 'moreIsGood',
    },
  ];
  return {
    tiles,
    pace: monthWritingPace(report.writingDays, now),
    sparse: isMonthSparse(report),
  };
}

/**
 * Purpose: first-week empty board — still designed, not a blank scoreboard.
 * Inputs: weekly report.
 * Outputs: true when there are no pages, no spend, and no habit hits in play.
 * Side effects: none.
 */
export function isWeekSparse(report: WeeklyInsightsReport): boolean {
  return report.pageCount === 0 && report.spendTotal === 0 && (report.habitHitRate === null || report.habitHitRate === 0);
}

/**
 * Purpose: first-month empty board.
 * Inputs: monthly report.
 * Outputs: true when pages, spend, habits, and worth snapshot are all empty.
 * Side effects: none.
 */
export function isMonthSparse(report: MonthlyInsightsReport): boolean {
  const noHabits = report.habitHitRate === null || report.habitHitRate === 0;
  return report.pageCount === 0 && report.spent === 0 && noHabits && !report.hasNetWorthSnapshot;
}

/**
 * Purpose: whether a reminder is an active recurring habit (mirrors habitStreaks private filter).
 * Inputs: Reminder.
 * Outputs: true when enabled and not a one-shot.
 * Side effects: none.
 */
function isActiveRecurringHabit(reminder: Reminder): boolean {
  return reminder.enabled && reminder.recurrence.type !== 'once';
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
