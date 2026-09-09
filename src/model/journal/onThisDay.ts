import type { JournalEntry } from './JournalEntry';
import { getMoodDefinition } from './Mood';

export interface OnThisDayMemory {
  entry: JournalEntry;
  yearsAgo: number;
  label: string;
  title: string;
  moodEmoji: string;
  moodLabel: string;
  hasPhoto: boolean;
}

/**
 * Purpose: journal pages from previous years on the same month/day (no AI).
 * Inputs: entries and now.
 * Outputs: up to 3 memories, photos first within a year; empty when none.
 * Side effects: none.
 * Design decisions: this year is excluded; one page per prior year; photos win over text-only on that day.
 */
export function onThisDayMemories(entries: JournalEntry[], now: Date = new Date(), limit = 3): OnThisDayMemory[] {
  const month = now.getMonth();
  const day = now.getDate();
  const thisYear = now.getFullYear();
  const byYear = new Map<number, JournalEntry[]>();

  for (const entry of entries) {
    const created = new Date(entry.createdAt);
    if (created.getFullYear() >= thisYear) {
      continue;
    }
    if (created.getMonth() !== month || created.getDate() !== day) {
      continue;
    }
    const year = created.getFullYear();
    const bucket = byYear.get(year) ?? [];
    bucket.push(entry);
    byYear.set(year, bucket);
  }

  const picked: OnThisDayMemory[] = [];
  const years = [...byYear.keys()].sort((left, right) => right - left);
  for (const year of years) {
    const group = byYear.get(year) ?? [];
    group.sort((left, right) => {
      const photo = Number(right.photoUris.length > 0) - Number(left.photoUris.length > 0);
      if (photo !== 0) {
        return photo;
      }
      return right.createdAt.localeCompare(left.createdAt);
    });
    const entry = group[0];
    if (!entry) {
      continue;
    }
    const yearsAgo = thisYear - year;
    const mood = getMoodDefinition(entry.mood);
    picked.push({
      entry,
      yearsAgo,
      label: yearsAgo === 1 ? '1 year ago' : `${yearsAgo} years ago`,
      title: entry.title.trim() || 'A page',
      moodEmoji: mood.emoji,
      moodLabel: mood.label,
      hasPhoto: entry.photoUris.length > 0,
    });
    if (picked.length >= limit) {
      break;
    }
  }

  return picked;
}
