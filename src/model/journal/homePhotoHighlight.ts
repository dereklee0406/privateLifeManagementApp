import type { WeekStart } from '../settings/AppSettings';
import { entriesThisWeek } from '../life/weeklySummary';
import { toDayKey } from '../../utils/dateUtils';
import type { JournalEntry } from './JournalEntry';
import { getMoodDefinition, type MoodId } from './Mood';
import { onThisDayMemories } from './onThisDay';

export type HomePhotoHighlightSource = 'onThisDay' | 'thisWeek' | 'recent';

export interface HomePhotoHighlight {
  uri: string;
  entryId: string;
  createdAt: string;
  mood: MoodId;
  moodEmoji: string;
  /** English mood label from the catalog — View localizes via mood.* */
  moodLabel: string;
  moodNote?: string;
  source: HomePhotoHighlightSource;
}

/**
 * Purpose: pick one warm photo for the Today highlight card.
 * Inputs: journal entries, now, weekStartsOn (same as Calendar / This week).
 * Outputs: one highlight or null when no page has a photo.
 * Side effects: none.
 * Design decisions: On this day (prior years) wins, then this week, then the last ~14 days —
 *   so Home can feel nostalgic without becoming a gallery.
 */
export function pickHomePhotoHighlight(
  entries: JournalEntry[],
  now: Date = new Date(),
  weekStartsOn: WeekStart = 'monday',
): HomePhotoHighlight | null {
  const onThisDay = onThisDayMemories(entries, now);
  for (const memory of onThisDay) {
    const uri = memory.entry.photoUris[0];
    if (memory.hasPhoto && uri) {
      return toHighlight(memory.entry, uri, 'onThisDay');
    }
  }

  const weekPhotos = entriesThisWeek(entries, now, weekStartsOn)
    .filter((entry) => entry.photoUris[0])
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const weekHit = weekPhotos[0];
  if (weekHit?.photoUris[0]) {
    return toHighlight(weekHit, weekHit.photoUris[0], 'thisWeek');
  }

  const recentCutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
  const cutoffKey = toDayKey(recentCutoff);
  const recent = [...entries]
    .filter((entry) => {
      if (!entry.photoUris[0]) {
        return false;
      }
      return toDayKey(new Date(entry.createdAt)) >= cutoffKey;
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const recentHit = recent[0];
  if (recentHit?.photoUris[0]) {
    return toHighlight(recentHit, recentHit.photoUris[0], 'recent');
  }

  return null;
}

function toHighlight(
  entry: JournalEntry,
  uri: string,
  source: HomePhotoHighlightSource,
): HomePhotoHighlight {
  const mood = getMoodDefinition(entry.mood);
  return {
    uri,
    entryId: entry.id,
    createdAt: entry.createdAt,
    mood: entry.mood,
    moodEmoji: mood.emoji,
    moodLabel: mood.label,
    moodNote: entry.moodNote?.trim() || undefined,
    source,
  };
}
