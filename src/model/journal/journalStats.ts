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
