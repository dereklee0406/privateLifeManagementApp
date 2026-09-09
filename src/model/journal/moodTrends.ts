import type { JournalEntry } from './JournalEntry';
import type { MoodId } from './Mood';
import { startOfLocalDay } from './journalStats';
import type { WeekStart } from '../settings/AppSettings';
import { startOfWeek } from '../life/weekBounds';
import { toDayKey } from '../../utils/dateUtils';

export type MoodClimate = 'happy' | 'neutral' | 'stress';

export interface ClimateShare {
  climate: MoodClimate;
  label: string;
  percent: number;
  count: number;
}

export interface Last30DaysSummary {
  total: number;
  shares: ClimateShare[];
}

export interface DailyMoodPoint {
  dayKey: string;
  label: string;
  mood: MoodId | null;
  climate: MoodClimate | null;
  count: number;
}

export interface ClimatePeriodPoint {
  key: string;
  label: string;
  happy: number;
  neutral: number;
  stress: number;
  total: number;
}

export interface MoodAnalysis {
  last30Days: Last30DaysSummary;
  daily: DailyMoodPoint[];
  weekly: ClimatePeriodPoint[];
  monthly: ClimatePeriodPoint[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

const CLIMATE_LABEL: Record<MoodClimate, string> = {
  happy: 'Happy',
  neutral: 'Neutral',
  stress: 'Stress',
};

/**
 * Purpose: map a journal mood onto the Happy / Neutral / Stress climate used on Aura.
 * Inputs: MoodId.
 * Outputs: climate bucket. 😊 → Happy, 😐 → Neutral, 😔 and 😡 → Stress.
 * Side effects: none.
 */
export function moodToClimate(mood: MoodId): MoodClimate {
  if (mood === 'happy') {
    return 'happy';
  }
  if (mood === 'neutral') {
    return 'neutral';
  }
  return 'stress';
}

function emptyClimateCounts(): Record<MoodClimate, number> {
  return { happy: 0, neutral: 0, stress: 0 };
}

function inWindow(createdAt: string, windowStart: number, windowEnd: number): boolean {
  const day = startOfLocalDay(new Date(createdAt));
  return day >= windowStart && day <= windowEnd;
}

/**
 * Purpose: Happy / Neutral / Stress share of entries in the last 30 local days.
 * Inputs: entries and optional now.
 * Outputs: counts and whole-number percents. Empty shares when there are no entries in the window (never fake numbers).
 * Side effects: none.
 */
export function computeLast30DaysSummary(entries: JournalEntry[], now: Date = new Date()): Last30DaysSummary {
  const today = startOfLocalDay(now);
  const windowStart = today - 29 * DAY_MS;
  const windowed = entries.filter((entry) => inWindow(entry.createdAt, windowStart, today));
  if (windowed.length === 0) {
    return { total: 0, shares: [] };
  }
  const counts = emptyClimateCounts();
  for (const entry of windowed) {
    counts[moodToClimate(entry.mood)] += 1;
  }
  const shares: ClimateShare[] = (['happy', 'neutral', 'stress'] as const).map((climate) => ({
    climate,
    label: CLIMATE_LABEL[climate],
    count: counts[climate],
    percent: Math.round((counts[climate] / windowed.length) * 100),
  }));
  const drift = shares.reduce((sum, share) => sum + share.percent, 0) - 100;
  if (drift !== 0) {
    const richest = [...shares].sort((left, right) => right.count - left.count)[0];
    richest.percent -= drift;
  }
  return { total: windowed.length, shares };
}

/**
 * Purpose: daily mood series for the last N local days (default 21, within the 14–30 day chart window).
 * Inputs: entries, now, day count.
 * Outputs: one point per day; mood is the newest page that day, or null if empty.
 * Side effects: none.
 */
export function computeDailyMoodSeries(
  entries: JournalEntry[],
  now: Date = new Date(),
  days = 21,
): DailyMoodPoint[] {
  const today = startOfLocalDay(now);
  const points: DailyMoodPoint[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today - offset * DAY_MS);
    const dayKey = toDayKey(date);
    const dayEntries = entries
      .filter((entry) => toDayKey(new Date(entry.createdAt)) === dayKey)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    const latest = dayEntries[0];
    points.push({
      dayKey,
      label: String(date.getDate()),
      mood: latest?.mood ?? null,
      climate: latest ? moodToClimate(latest.mood) : null,
      count: dayEntries.length,
    });
  }
  return points;
}

/**
 * Purpose: Happy / Neutral / Stress counts by local week for recent weeks.
 * Inputs: entries, now, week count (newest week last), weekStartsOn (same as Calendar / This week).
 * Outputs: stacked-bar series.
 * Side effects: none.
 * Design decisions: not ISO week numbers — buckets follow You → Customize · Week starts on.
 */
export function computeWeeklyTrend(
  entries: JournalEntry[],
  now: Date = new Date(),
  weeks = 8,
  weekStartsOn: WeekStart = 'monday',
): ClimatePeriodPoint[] {
  const currentStart = startOfLocalDay(startOfWeek(now, weekStartsOn));
  const points: ClimatePeriodPoint[] = [];
  for (let index = weeks - 1; index >= 0; index -= 1) {
    const weekStart = currentStart - index * 7 * DAY_MS;
    const weekEnd = weekStart + 6 * DAY_MS;
    const counts = emptyClimateCounts();
    for (const entry of entries) {
      if (inWindow(entry.createdAt, weekStart, weekEnd)) {
        counts[moodToClimate(entry.mood)] += 1;
      }
    }
    const startDate = new Date(weekStart);
    points.push({
      key: toDayKey(startDate),
      label: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(startDate),
      happy: counts.happy,
      neutral: counts.neutral,
      stress: counts.stress,
      total: counts.happy + counts.neutral + counts.stress,
    });
  }
  return points;
}

/**
 * Purpose: Happy / Neutral / Stress counts by calendar month for recent months.
 * Inputs: entries, now, month count (newest last).
 * Outputs: stacked-bar series.
 * Side effects: none.
 */
export function computeMonthlyTrend(
  entries: JournalEntry[],
  now: Date = new Date(),
  months = 6,
): ClimatePeriodPoint[] {
  const points: ClimatePeriodPoint[] = [];
  for (let index = months - 1; index >= 0; index -= 1) {
    const cursor = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const monthStart = startOfLocalDay(cursor);
    const monthEnd = startOfLocalDay(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));
    const counts = emptyClimateCounts();
    for (const entry of entries) {
      if (inWindow(entry.createdAt, monthStart, monthEnd)) {
        counts[moodToClimate(entry.mood)] += 1;
      }
    }
    points.push({
      key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
      label: new Intl.DateTimeFormat(undefined, { month: 'short' }).format(cursor),
      happy: counts.happy,
      neutral: counts.neutral,
      stress: counts.stress,
      total: counts.happy + counts.neutral + counts.stress,
    });
  }
  return points;
}

/**
 * Purpose: snapshot consumed by the Aura screen.
 * Inputs: entries, optional now, and weekStartsOn shared with Calendar / This week.
 * Outputs: 30-day percents plus daily, weekly, and monthly series.
 * Side effects: none.
 */
export function computeMoodAnalysis(
  entries: JournalEntry[],
  now: Date = new Date(),
  weekStartsOn: WeekStart = 'monday',
): MoodAnalysis {
  return {
    last30Days: computeLast30DaysSummary(entries, now),
    daily: computeDailyMoodSeries(entries, now, 21),
    weekly: computeWeeklyTrend(entries, now, 8, weekStartsOn),
    monthly: computeMonthlyTrend(entries, now, 6),
  };
}
