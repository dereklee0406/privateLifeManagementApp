import type { JournalEntry, JournalEntryKind } from './JournalEntry';
import { countWords } from './journalStats';
import { normalizeMoodNote } from './moodNote';
import { normalizeMoodId } from './Mood';
import { normalizeTags } from './tags';

/**
 * Purpose: hydrate a stored JSON record onto the current JournalEntry shape.
 * Inputs: unknown parsed JSON (v1 six-mood pages or current records).
 * Outputs: a valid JournalEntry, or null when the record is unusable.
 * Side effects: none.
 * Design decisions: missing media fields default to empty so old pages keep loading; binaries are never reconstructed here.
 */
export function normalizeEntry(raw: unknown): JournalEntry | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.createdAt !== 'string') {
    return null;
  }
  const body = typeof record.body === 'string' ? record.body : '';
  const kind: JournalEntryKind = record.kind === 'voice' ? 'voice' : 'text';
  const photoUris = Array.isArray(record.photoUris)
    ? record.photoUris.filter((uri): uri is string => typeof uri === 'string' && uri.length > 0)
    : [];
  const voiceUri = typeof record.voiceUri === 'string' && record.voiceUri ? record.voiceUri : undefined;
  const voiceDurationMs =
    typeof record.voiceDurationMs === 'number' && Number.isFinite(record.voiceDurationMs)
      ? Math.max(0, record.voiceDurationMs)
      : undefined;
  const tags = Array.isArray(record.tags)
    ? normalizeTags(record.tags.filter((tag): tag is string => typeof tag === 'string'))
    : [];

  return {
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : record.createdAt,
    kind,
    title: typeof record.title === 'string' && record.title.trim() ? record.title : kind === 'voice' ? 'Voice page' : 'Untitled page',
    body,
    bodyFormat: 'markdown',
    mood: normalizeMoodId(typeof record.mood === 'string' ? record.mood : 'neutral'),
    moodNote: normalizeMoodNote(record.moodNote),
    tags,
    wordCount: typeof record.wordCount === 'number' ? record.wordCount : countWords(body),
    photoUris,
    voiceUri,
    voiceDurationMs,
    location: parseLocation(record.location),
  };
}

/**
 * Purpose: normalize an array of stored records, dropping anything unreadable.
 * Inputs: parsed JSON array.
 * Outputs: JournalEntry list.
 * Side effects: none.
 */
export function normalizeEntries(raw: unknown): JournalEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map(normalizeEntry).filter((entry): entry is JournalEntry => entry !== null);
}

function parseLocation(raw: unknown): JournalEntry['location'] {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const value = raw as Record<string, unknown>;
  if (typeof value.name !== 'string' || !value.name.trim()) {
    return undefined;
  }
  const latitude = typeof value.latitude === 'number' ? value.latitude : undefined;
  const longitude = typeof value.longitude === 'number' ? value.longitude : undefined;
  return { name: value.name.trim(), latitude, longitude };
}
