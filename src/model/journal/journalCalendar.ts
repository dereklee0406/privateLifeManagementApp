import type { JournalEntry } from './JournalEntry';
import type { MoodId } from './Mood';
import { startOfLocalDay } from './journalStats';
import type { WeekStart } from '../settings/AppSettings';
import { toDayKey } from '../../utils/dateUtils';

export interface CalendarCell {
  dayKey: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
  entryCount: number;
  mood: MoodId | null;
}

export interface CalendarMonth {
  year: number;
  month: number;
  heading: string;
  weekdayLabels: string[];
  cells: CalendarCell[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Purpose: list pages that belong to a local calendar day.
 * Inputs: entries and YYYY-MM-DD key.
 * Outputs: matching entries, newest first.
 * Side effects: none.
 */
export function entriesOnDay(entries: JournalEntry[], dayKey: string): JournalEntry[] {
  return entries
    .filter((entry) => toDayKey(new Date(entry.createdAt)) === dayKey)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

/**
 * Purpose: build a month grid with mood color data, first column matching weekStart.
 * Inputs: year, 0-based month, journal entries, weekStart (default Monday — same as This week).
 * Outputs: CalendarMonth of 42 cells (6 weeks).
 * Side effects: none.
 * Design decisions: a day's color is the newest entry's mood so the grid stays a single readable orb.
 *   Used to be Sunday-first via Date.getDay(); now shares AppSettings.weekStart with Today/You.
 */
export function buildCalendarMonth(
  year: number,
  month: number,
  entries: JournalEntry[],
  weekStart: WeekStart = 'monday',
  locale?: string,
): CalendarMonth {
  const first = new Date(year, month, 1);
  const heading = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(first);
  const labelOrigin = weekStart === 'sunday' ? 6 : 7;
  const weekdayLabels = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(2026, 8, labelOrigin + index);
    return new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(date);
  });

  const byDay = new Map<string, JournalEntry[]>();
  for (const entry of entries) {
    const key = toDayKey(new Date(entry.createdAt));
    const list = byDay.get(key) ?? [];
    list.push(entry);
    byDay.set(key, list);
  }

  const startDow = weekStart === 'sunday' ? 0 : 1;
  const startOffset = (first.getDay() - startDow + 7) % 7;
  const gridStart = startOfLocalDay(first) - startOffset * DAY_MS;
  const cells: CalendarCell[] = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(gridStart + index * DAY_MS);
    const dayKey = toDayKey(date);
    const dayEntries = (byDay.get(dayKey) ?? []).sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
    cells.push({
      dayKey,
      dayOfMonth: date.getDate(),
      inCurrentMonth: date.getMonth() === month,
      entryCount: dayEntries.length,
      mood: dayEntries[0]?.mood ?? null,
    });
  }

  return { year, month, heading, weekdayLabels, cells };
}

/**
 * Purpose: shift a calendar month by a signed offset.
 * Inputs: year, month, delta months.
 * Outputs: next year/month pair.
 * Side effects: none.
 */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}
