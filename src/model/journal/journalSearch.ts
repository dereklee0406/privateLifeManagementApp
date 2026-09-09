import type { JournalEntry } from './JournalEntry';
import type { MoodId } from './Mood';
import { startOfLocalDay } from './journalStats';
import { toDayKey } from '../../utils/dateUtils';

export type DateRangePreset = 'any' | '7d' | '30d' | 'year';

export interface JournalSearchQuery {
  keywords: string;
  mood: MoodId | null;
  tags: string[];
  fromDay: string | null;
  toDay: string | null;
}

export interface JournalSearchInput {
  keywords: string;
  mood: MoodId | null;
  tags: string[];
  datePreset: DateRangePreset;
}

/**
 * Purpose: empty search form state.
 * Inputs: none.
 * Outputs: an identity filter (show everything).
 * Side effects: none.
 */
export function emptySearchInput(): JournalSearchInput {
  return { keywords: '', mood: null, tags: [], datePreset: 'any' };
}

/**
 * Purpose: map a UX date preset onto inclusive local day keys.
 * Inputs: preset and "now" for testability.
 * Outputs: fromDay/toDay (YYYY-MM-DD) or nulls for Any.
 * Side effects: none.
 */
export function rangeFromPreset(
  preset: DateRangePreset,
  now: Date = new Date(),
): Pick<JournalSearchQuery, 'fromDay' | 'toDay'> {
  const today = toDayKey(now);
  if (preset === 'any') {
    return { fromDay: null, toDay: null };
  }
  if (preset === '7d') {
    const from = new Date(startOfLocalDay(now) - 6 * 24 * 60 * 60 * 1000);
    return { fromDay: toDayKey(from), toDay: today };
  }
  if (preset === '30d') {
    const from = new Date(startOfLocalDay(now) - 29 * 24 * 60 * 60 * 1000);
    return { fromDay: toDayKey(from), toDay: today };
  }
  return { fromDay: `${now.getFullYear()}-01-01`, toDay: today };
}

/**
 * Purpose: expand search form state into a filter query.
 * Inputs: search input and optional now.
 * Outputs: JournalSearchQuery used by filterEntries.
 * Side effects: none.
 */
export function toSearchQuery(input: JournalSearchInput, now: Date = new Date()): JournalSearchQuery {
  const range = rangeFromPreset(input.datePreset, now);
  return {
    keywords: input.keywords,
    mood: input.mood,
    tags: input.tags,
    fromDay: range.fromDay,
    toDay: range.toDay,
  };
}

/**
 * Purpose: filter pages by keywords, mood, tags, and inclusive local date range.
 * Inputs: entries plus a query. Empty fields mean "no constraint".
 * Outputs: matching entries, original order preserved.
 * Side effects: none.
 * Design decisions: keywords search title + body + mood note; tags use AND (every selected tag must be present); date compares local calendar days.
 */
export function filterEntries(entries: JournalEntry[], query: JournalSearchQuery): JournalEntry[] {
  const needle = query.keywords.trim().toLowerCase();
  const requiredTags = query.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean);

  return entries.filter((entry) => {
    if (needle) {
      const haystack = `${entry.title} ${entry.body} ${entry.moodNote ?? ''}`.toLowerCase();
      if (!haystack.includes(needle)) {
        return false;
      }
    }
    if (query.mood && entry.mood !== query.mood) {
      return false;
    }
    if (requiredTags.some((tag) => !entry.tags.includes(tag))) {
      return false;
    }
    const day = toDayKey(new Date(entry.createdAt));
    if (query.fromDay && day < query.fromDay) {
      return false;
    }
    if (query.toDay && day > query.toDay) {
      return false;
    }
    return true;
  });
}

/**
 * Purpose: run the Pages/Search pipeline from form state.
 * Inputs: entries, search input, optional now.
 * Outputs: filtered entries.
 * Side effects: none.
 */
export function searchJournal(
  entries: JournalEntry[],
  input: JournalSearchInput,
  now: Date = new Date(),
): JournalEntry[] {
  return filterEntries(entries, toSearchQuery(input, now));
}
