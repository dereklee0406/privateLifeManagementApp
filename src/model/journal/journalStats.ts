import type { JournalEntry } from './JournalEntry';
import { stripMarkdown } from './markdown';
import type { MoodId } from './Mood';
import type { WeekStart } from '../settings/AppSettings';
import { thisWeekSoFar } from '../life/weekBounds';

export interface MoodShare {
  mood: MoodId;
  count: number;
}

export interface JournalInsights {
  entryCount: number;
  wordCount: number;
  streakDays: number;
  writingDaysThisWeek: number;
  moodShares: MoodShare[];
}

/**
 * Purpose: count words in a journal body using a simple whitespace split.
 * Inputs: free-text body.
 * Outputs: non-negative integer word count.
 * Side effects: none.
 * Design decisions: keep counting deterministic and locale-light for shared Android/iOS behavior.
 */
export function countWords(body: string): number {
  const trimmed = stripMarkdown(body);
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

/**
 * Purpose: normalize a timestamp to local start-of-day milliseconds.
 * Inputs: Date-compatible value.
 * Outputs: epoch ms at 00:00:00.000 local time.
 * Side effects: none.
 */
export function startOfLocalDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

/**
 * Purpose: compute consecutive local-day writing streak ending today.
 * Inputs: entries with createdAt ISO timestamps, and "now" for testability.
 * Outputs: number of consecutive days with at least one entry, including today if written.
 * Side effects: none.
 * Design decisions: a missed calendar day breaks the streak; multiple entries on one day count once.
 */
export function computeStreak(entries: JournalEntry[], now: Date = new Date()): number {
  const daysWithEntries = new Set(
    entries.map((entry) => startOfLocalDay(new Date(entry.createdAt))),
  );
  let cursor = startOfLocalDay(now);
  if (!daysWithEntries.has(cursor)) {
    cursor -= 24 * 60 * 60 * 1000;
  }
  let streak = 0;
  while (daysWithEntries.has(cursor)) {
    streak += 1;
    cursor -= 24 * 60 * 60 * 1000;
  }
  return streak;
}

/**
 * Purpose: count distinct local days written in the current week so far.
 * Inputs: entries, now, and weekStart (same as Calendar / This week).
 * Outputs: integer 0-7.
 * Side effects: none.
 */
export function computeWritingDaysThisWeek(
  entries: JournalEntry[],
  now: Date = new Date(),
  weekStart: WeekStart = 'monday',
): number {
  const range = thisWeekSoFar(now, weekStart);
  const weekStartMs = startOfLocalDay(range.start);
  const todayMs = startOfLocalDay(now);
  const days = new Set<number>();
  for (const entry of entries) {
    const dayStart = startOfLocalDay(new Date(entry.createdAt));
    if (dayStart >= weekStartMs && dayStart <= todayMs) {
      days.add(dayStart);
    }
  }
  return days.size;
}

/**
 * Purpose: count distinct local days written in a trailing window ending today.
 * Inputs: entries, now, window length in civil days (default 30, inclusive of today).
 * Outputs: integer 0…windowDays.
 * Side effects: none.
 * Design decisions: a day with several pages still counts once; days before the window are ignored.
 */
export function computeWritingDaysInWindow(
  entries: JournalEntry[],
  now: Date = new Date(),
  windowDays = 30,
): number {
  const safeWindow = Math.max(1, Math.floor(windowDays));
  const todayMs = startOfLocalDay(now);
  const startMs = startOfLocalDay(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - (safeWindow - 1)),
  );
  const days = new Set<number>();
  for (const entry of entries) {
    const dayStart = startOfLocalDay(new Date(entry.createdAt));
    if (dayStart >= startMs && dayStart <= todayMs) {
      days.add(dayStart);
    }
  }
  return days.size;
}

/**
 * Purpose: count distinct local days written in a calendar month (1st through today or month end).
 * Inputs: entries, year, month (0–11), now (clamps the end to today when in that month).
 * Outputs: integer 0…days in month.
 * Side effects: none.
 */
export function computeWritingDaysInMonth(
  entries: JournalEntry[],
  year: number,
  month: number,
  now: Date = new Date(),
): number {
  const monthStart = new Date(year, month, 1).getTime();
  const monthEndExclusive = new Date(year, month + 1, 1).getTime();
  const todayMs = startOfLocalDay(now);
  const days = new Set<number>();
  for (const entry of entries) {
    const dayStart = startOfLocalDay(new Date(entry.createdAt));
    if (dayStart < monthStart || dayStart >= monthEndExclusive) {
      continue;
    }
    if (year === now.getFullYear() && month === now.getMonth() && dayStart > todayMs) {
      continue;
    }
    days.add(dayStart);
  }
  return days.size;
}

/**
 * Purpose: pages whose civil day sits in a calendar month.
 * Inputs: entries, year, month (0–11).
 * Outputs: matching pages (does not clamp to today).
 * Side effects: none.
 */
export function entriesInMonth(entries: JournalEntry[], year: number, month: number): JournalEntry[] {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  return entries.filter((entry) => {
    const created = new Date(entry.createdAt);
    const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
    return key === prefix;
  });
}

/**
 * Purpose: aggregate mood frequencies for insight charts.
 * Inputs: entries.
 * Outputs: MoodShare list sorted by count descending.
 * Side effects: none.
 */
export function computeMoodShares(entries: JournalEntry[]): MoodShare[] {
  const counts = new Map<MoodId, number>();
  for (const entry of entries) {
    counts.set(entry.mood, (counts.get(entry.mood) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([mood, count]) => ({ mood, count }))
    .sort((left, right) => right.count - left.count);
}

/**
 * Purpose: build the insights snapshot used by the Insights screen.
 * Inputs: full entry list, optional now, and weekStart shared with Calendar / This week.
 * Outputs: JournalInsights aggregate.
 * Side effects: none.
 */
export function computeInsights(
  entries: JournalEntry[],
  now: Date = new Date(),
  weekStart: WeekStart = 'monday',
): JournalInsights {
  return {
    entryCount: entries.length,
    wordCount: entries.reduce((sum, entry) => sum + entry.wordCount, 0),
    streakDays: computeStreak(entries, now),
    writingDaysThisWeek: computeWritingDaysThisWeek(entries, now, weekStart),
    moodShares: computeMoodShares(entries),
  };
}
