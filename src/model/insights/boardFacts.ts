import type { Expense } from '../finance/Expense';
import type { NetWorthHistoryRow } from '../finance/netWorthHistory';
import { netWorthSparkSeries, type NetWorthSparkPoint } from '../finance/netWorthSparkline';
import type { JournalEntry } from '../journal/JournalEntry';
import { normalizeMoodId, type MoodId } from '../journal/Mood';
import type { Reminder } from '../reminders/Reminder';
import { habitHitRateBetween } from '../reminders/habitStreaks';
import type { MoneyCurrency, WeekStart } from '../settings/AppSettings';
import { toDayKey } from '../../utils/dateUtils';
import { alignedPreviousWeekSoFar, startOfWeek, thisWeekSoFar } from '../life/weekBounds';
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
 * Purpose: one civil day in the month writing bar chart (30-ish cells).
 * Inputs: monthWritingBars.
 * Outputs: flags for View bars. Future days stay empty, not guessed.
 * Side effects: none.
 */
export interface MonthWritingBar {
  dayKey: string;
  wrote: boolean;
  isToday: boolean;
  isFuture: boolean;
}

/**
 * Purpose: this vs last period as two bar heights (spend compare, not a table).
 * Inputs: compareBarRatios.
 * Outputs: raw amounts + 0–1 ratios scaled to the larger amount.
 * Side effects: none.
 */
export interface CompareBars {
  current: number;
  previous: number;
  currentRatio: number;
  previousRatio: number;
  hasPrevious: boolean;
}

/**
 * Purpose: habit-hit meter for a View bar/ring (0–1, or missing domain).
 * Inputs: computeWeeklyBoardFacts / computeMonthlyBoardFacts.
 * Outputs: rate null when there is no habit in play (empty frame, don’t fake 0%).
 * Side effects: none.
 */
export interface HabitMeter {
  rate: number | null;
}

/** Four-mood mix order for Insights stacked bar — ids stay storage ids. */
export const MOOD_MIX_ORDER: readonly MoodId[] = ['happy', 'neutral', 'sad', 'angry'];

/**
 * Purpose: one Good / Steady / Off / Rough slice for a stacked mood bar.
 * Inputs: moodClimateSegments.
 * Outputs: language-free count + 0–1 share. View localizes via mood.* keys.
 * Side effects: none.
 * Design decisions: four MoodIds, not Happy/Neutral/Stress climate. Off (sad) is its own slice.
 */
export interface MoodClimateSegment {
  climate: MoodId;
  count: number;
  share: number;
}

/**
 * Purpose: This week board pack — glance tiles + chart series + sparse flag.
 * Inputs: computeWeeklyBoardFacts.
 * Outputs: language-free facts. Pressure stays on WeeklyInsightsReport.
 * Side effects: none.
 * Design decisions: tiles stay for briefs / captions. Charts (strip, spend compare,
 *   habit meter, mood mix) are the primary board — not a 2×2 word grid.
 */
export interface WeeklyBoardFacts {
  tiles: InsightsGlanceTile[];
  strip: WeekStripCell[];
  spendCompare: CompareBars;
  habitMeter: HabitMeter;
  moodClimate: MoodClimateSegment[];
  sparse: boolean;
}

/**
 * Purpose: This month board pack — glance tiles + chart series + sparse flag.
 * Inputs: computeMonthlyBoardFacts.
 * Outputs: language-free facts. Pressure stays on MonthlyInsightsReport.
 * Side effects: none.
 * Design decisions: 30-bar writing + Worth sparkline + last-30 mood mix. Tiles stay
 *   for captions and briefs, not as the equal-weight face of the screen.
 */
export interface MonthlyBoardFacts {
  tiles: InsightsGlanceTile[];
  pace: MonthPace;
  writingBars: MonthWritingBar[];
  spendCompare: CompareBars;
  habitMeter: HabitMeter;
  moodClimate: MoodClimateSegment[];
  worthSpark: NetWorthSparkPoint[];
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

const COMPARE_FLOOR = 0.12;

/**
 * Purpose: map this vs last amounts onto 0–1 bar heights for a two-bar compare chart.
 * Inputs: current amount, previous amount, whether a real previous period exists.
 * Outputs: CompareBars. Zero stays 0 (empty stub, not a fake floor).
 * Side effects: none.
 * Design decisions: scale to max(current, previous). A missing previous period still
 *   draws the “last” slot at 0 so the frame stays designed. Non-zero bars keep a floor
 *   so a tiny amount still reads. View draws static Views (reduce-motion has nothing to skip).
 */
export function compareBarRatios(current: number, previous: number, hasPrevious: boolean): CompareBars {
  const safeCurrent = Number.isFinite(current) && current > 0 ? current : 0;
  const safePrevious = hasPrevious && Number.isFinite(previous) && previous > 0 ? previous : 0;
  const max = Math.max(safeCurrent, safePrevious);
  const ratioOf = (value: number): number => {
    if (max <= 0 || value <= 0) {
      return 0;
    }
    return Math.max(COMPARE_FLOOR, value / max);
  };
  return {
    current: safeCurrent,
    previous: safePrevious,
    currentRatio: ratioOf(safeCurrent),
    previousRatio: ratioOf(safePrevious),
    hasPrevious,
  };
}

/**
 * Purpose: one bar per civil day this month — wrote fill; future stays empty.
 * Inputs: journal entries, now.
 * Outputs: daysInMonth cells (28–31), not a calendar dump or heatmap.
 * Side effects: none.
 * Design decisions: full month width so the frame does not jump as the month elapses.
 *   Several pages on one day still count as one filled bar.
 */
export function monthWritingBars(entries: JournalEntry[], now: Date): MonthWritingBar[] {
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = toDayKey(now);
  const wrote = new Set<string>();
  for (const entry of entries) {
    wrote.add(toDayKey(new Date(entry.createdAt)));
  }
  const bars: MonthWritingBar[] = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const dayKey = toDayKey(date);
    bars.push({
      dayKey,
      wrote: wrote.has(dayKey),
      isToday: dayKey === todayKey,
      isFuture: dayKey > todayKey,
    });
  }
  return bars;
}

/**
 * Purpose: Good / Steady / Off / Rough mix in an inclusive YYYY-MM-DD window.
 * Inputs: journal entries, start/end keys.
 * Outputs: four segments in MoodId order; shares sum to 1 when there is at least one page.
 * Side effects: none.
 * Design decisions: counts stored mood ids (legacy mapped via normalizeMoodId). Empty window
 *   returns four zero slices so View can still draw a designed frame. Not a spa climate essay.
 */
export function moodClimateSegments(
  entries: JournalEntry[],
  startKey: string,
  endKey: string,
): MoodClimateSegment[] {
  const counts: Record<MoodId, number> = { happy: 0, neutral: 0, sad: 0, angry: 0 };
  for (const entry of entries) {
    const key = toDayKey(new Date(entry.createdAt));
    if (key >= startKey && key <= endKey) {
      counts[normalizeMoodId(entry.mood)] += 1;
    }
  }
  const total = counts.happy + counts.neutral + counts.sad + counts.angry;
  if (total === 0) {
    return emptyMoodClimate();
  }
  return MOOD_MIX_ORDER.map((climate) => ({
    climate,
    count: counts[climate],
    share: counts[climate] / total,
  }));
}

/**
 * Purpose: last-30 local days inclusive of `now` for the month mood mix.
 * Inputs: now.
 * Outputs: start/end YYYY-MM-DD keys (30 days).
 * Side effects: none.
 * Design decisions: same 30-day inclusive window as Season writing days.
 */
function last30DayKeys(now: Date): { startKey: string; endKey: string } {
  const endKey = toDayKey(now);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  return { startKey: toDayKey(start), endKey };
}

/**
 * Purpose: This week glance tiles + chart series from the weekly report plus aligned last week.
 * Inputs: current WeeklyInsightsReport, same sources used to build it, now, week start.
 * Outputs: WeeklyBoardFacts (pure).
 * Side effects: none.
 * Design decisions: vs-last uses alignedPreviousWeekSoFar so Wednesday is not punished vs
 *   last week’s seven days. Spend last-week is the same window. Mood mix is this week so far
 *   (four MoodIds, not the 8-week dump). Sparse = no pages, no spend,
 *   and no habit domain or a 0% hit — View still draws empty chart frames and invites.
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
  const week = thisWeekSoFar(now, weekStartsOn);
  return {
    tiles,
    strip: weekActivityStrip(entries, reminders, now, weekStartsOn),
    spendCompare: compareBarRatios(report.spendTotal, lastSpend, lastSpend > 0),
    habitMeter: { rate: report.habitHitRate },
    moodClimate: moodClimateSegments(entries, week.startKey, week.endKey),
    sparse: isWeekSparse(report),
  };
}

/**
 * Purpose: This month glance tiles + chart series from the monthly report plus aligned last month.
 * Inputs: current MonthlyInsightsReport, journal/reminders for aligned writing/habit, now,
 *   optional net-worth history for the Worth sparkline.
 * Outputs: MonthlyBoardFacts (pure).
 * Side effects: none.
 * Design decisions: spend vs last month reuses the report (full previous month, same as the
 *   takeaway). Pages / writing days / habits use aligned month-to-date so the 12th is not
 *   scored against all of last month. Worth spark reuses netWorthSparkSeries. Mood mix is
 *   last-30 MoodIds (Good / Steady / Off / Rough), not a climate essay.
 */
export function computeMonthlyBoardFacts(
  report: MonthlyInsightsReport,
  entries: JournalEntry[],
  reminders: Reminder[],
  now: Date,
  history: NetWorthHistoryRow[] = [],
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
  const moodWindow = last30DayKeys(now);
  return {
    tiles,
    pace: monthWritingPace(report.writingDays, now),
    writingBars: monthWritingBars(entries, now),
    spendCompare: compareBarRatios(report.spent, report.previousSpent, report.hasPreviousSpend),
    habitMeter: { rate: report.habitHitRate },
    moodClimate: moodClimateSegments(entries, moodWindow.startKey, moodWindow.endKey),
    worthSpark: netWorthSparkSeries(history, report.currency),
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

/**
 * Purpose: four empty mood slices so View can still draw a designed mood frame.
 * Inputs: none.
 * Outputs: happy / neutral / sad / angry at count 0, share 0.
 * Side effects: none.
 */
function emptyMoodClimate(): MoodClimateSegment[] {
  return MOOD_MIX_ORDER.map((climate) => ({
    climate,
    count: 0,
    share: 0,
  }));
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
