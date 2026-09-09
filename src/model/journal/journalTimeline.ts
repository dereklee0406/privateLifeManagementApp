import type { JournalEntry } from './JournalEntry';
import { startOfLocalDay } from './journalStats';

export type TimelineBucket = 'today' | 'yesterday' | 'lastWeek' | 'lastMonth' | 'earlier';

export interface TimelineSection {
  bucket: TimelineBucket;
  label: string;
  entries: JournalEntry[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

const LABELS: Record<TimelineBucket, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  lastWeek: 'Last Week',
  lastMonth: 'Last Month',
  earlier: 'Earlier',
};

const ORDER: TimelineBucket[] = ['today', 'yesterday', 'lastWeek', 'lastMonth', 'earlier'];

/**
 * Purpose: assign a page to a local-calendar feed bucket.
 * Inputs: entry createdAt and "now".
 * Outputs: TimelineBucket.
 * Side effects: none.
 * Design decisions: Last Week is days 2–6 ago (after yesterday, still inside the last 7 local days). Last Month is days 7–29 ago. Older pages go to Earlier so nothing is hidden.
 */
export function timelineBucketFor(createdAt: string, now: Date = new Date()): TimelineBucket {
  const today = startOfLocalDay(now);
  const created = startOfLocalDay(new Date(createdAt));
  const daysAgo = Math.round((today - created) / DAY_MS);
  if (daysAgo <= 0) {
    return 'today';
  }
  if (daysAgo === 1) {
    return 'yesterday';
  }
  if (daysAgo <= 6) {
    return 'lastWeek';
  }
  if (daysAgo <= 29) {
    return 'lastMonth';
  }
  return 'earlier';
}

/**
 * Purpose: group pages into a private social-style feed.
 * Inputs: entries (newest-first preferred) and optional now.
 * Outputs: sections with at least one entry, in Today → Earlier order. Within a section, newest first.
 * Side effects: none.
 */
export function groupTimeline(entries: JournalEntry[], now: Date = new Date()): TimelineSection[] {
  const buckets = new Map<TimelineBucket, JournalEntry[]>();
  const sorted = [...entries].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
  for (const entry of sorted) {
    const bucket = timelineBucketFor(entry.createdAt, now);
    const list = buckets.get(bucket) ?? [];
    list.push(entry);
    buckets.set(bucket, list);
  }
  return ORDER.filter((bucket) => (buckets.get(bucket)?.length ?? 0) > 0).map((bucket) => ({
    bucket,
    label: LABELS[bucket],
    entries: buckets.get(bucket) ?? [],
  }));
}
