import type { JournalEntry } from './JournalEntry';
import type { MoodId } from './Mood';
import { formatMonthHeading, toDayKey } from '../../utils/dateUtils';

export interface PhotoMemory {
  uri: string;
  entryId: string;
  createdAt: string;
  title: string;
  mood: MoodId;
  moodNote?: string;
}

export type PhotoMemoryFilter = 'all' | 'month' | 'year';

export interface PhotoMemoryMonthGroup {
  monthKey: string;
  label: string;
  photos: PhotoMemory[];
}

/**
 * Purpose: flatten journal photo URIs for a simple memories gallery.
 * Inputs: journal entries.
 * Outputs: photos newest first (entry order, then photo order).
 * Side effects: none.
 * Design decisions: photos stay on the page that owns them — this is a gallery index, not a vault.
 */
export function collectJournalPhotos(entries: JournalEntry[]): PhotoMemory[] {
  const rows: PhotoMemory[] = [];
  const newestFirst = [...entries].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  for (const entry of newestFirst) {
    for (const uri of entry.photoUris) {
      if (!uri) {
        continue;
      }
      rows.push({
        uri,
        entryId: entry.id,
        createdAt: entry.createdAt,
        title: entry.title.trim() || 'A page',
        mood: entry.mood,
        moodNote: entry.moodNote,
      });
    }
  }
  return rows;
}

/**
 * Purpose: keep All / This Month / This Year photos from journal pages only.
 * Inputs: flattened photos, filter, now.
 * Outputs: matching photos (original newest-first order).
 * Side effects: none.
 */
export function filterJournalPhotos(
  photos: PhotoMemory[],
  filter: PhotoMemoryFilter,
  now: Date = new Date(),
): PhotoMemory[] {
  if (filter === 'all') {
    return photos;
  }
  const year = now.getFullYear();
  const month = now.getMonth();
  return photos.filter((item) => {
    const created = new Date(item.createdAt);
    if (filter === 'year') {
      return created.getFullYear() === year;
    }
    return created.getFullYear() === year && created.getMonth() === month;
  });
}

/**
 * Purpose: group memories by local month for the Photos screen.
 * Inputs: already-filtered photos, optional Intl locale for the month heading.
 * Outputs: month buckets newest first.
 * Side effects: none.
 */
export function groupPhotosByMonth(photos: PhotoMemory[], locale?: string): PhotoMemoryMonthGroup[] {
  const groups = new Map<string, PhotoMemory[]>();
  for (const item of photos) {
    const created = new Date(item.createdAt);
    const monthKey = toDayKey(created).slice(0, 7);
    const bucket = groups.get(monthKey) ?? [];
    bucket.push(item);
    groups.set(monthKey, bucket);
  }
  return [...groups.entries()]
    .sort((left, right) => right[0].localeCompare(left[0]))
    .map(([monthKey, rows]) => ({
      monthKey,
      label: formatMonthHeading(rows[0]?.createdAt ?? `${monthKey}-01`, locale),
      photos: rows,
    }));
}

/**
 * Purpose: keep a reel index inside the photo list.
 * Inputs: proposed index, list length.
 * Outputs: 0 when empty; otherwise 0…total-1.
 * Side effects: none.
 */
export function clampPhotoIndex(index: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(total - 1, Math.trunc(index)));
}

/**
 * Purpose: step one photo in the private reel without looping like a social feed.
 * Inputs: current index, list length, +1 next / -1 previous.
 * Outputs: clamped index (0 when empty).
 * Side effects: none.
 * Design decisions: ends stay put — wrapping would feel like Instagram, not her album.
 */
export function stepPhotoIndex(current: number, total: number, delta: 1 | -1): number {
  return clampPhotoIndex(current + delta, total);
}
