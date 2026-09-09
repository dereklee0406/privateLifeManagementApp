import type { MoodId } from './Mood';

export type JournalEntryKind = 'text' | 'voice';
export type BodyFormat = 'markdown';

export interface JournalLocation {
  name: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Purpose: represent a persisted journal page in domain language.
 * Inputs: constructed by controllers after validation.
 * Outputs: immutable-shaped record stored by the repository.
 * Side effects: none.
 * Design decisions: dates are ISO strings so the model stays framework-free and JSON-safe. Media is referenced by URI, never inlined as binaries. kind distinguishes voice-primary journal pages from written pages that may still carry an optional clip. location is optional place metadata (name always; lat/lng when captured on phone). moodNote is optional 80-char context beside the emoji; missing on old pages.
 */
export interface JournalEntry {
  id: string;
  createdAt: string;
  updatedAt: string;
  kind: JournalEntryKind;
  title: string;
  body: string;
  bodyFormat: BodyFormat;
  mood: MoodId;
  /** Optional one-line context beside the mood, e.g. “Dinner with family”. Max 80 chars. */
  moodNote?: string;
  tags: string[];
  wordCount: number;
  photoUris: string[];
  voiceUri?: string;
  voiceDurationMs?: number;
  location?: JournalLocation;
}

export interface JournalDraft {
  kind?: JournalEntryKind;
  title: string;
  body: string;
  bodyFormat?: BodyFormat;
  mood: MoodId;
  moodNote?: string;
  tags: string[];
  photoUris?: string[];
  voiceUri?: string;
  voiceDurationMs?: number;
  createdAt?: string;
  location?: JournalLocation;
}

export interface JournalPatch {
  kind?: JournalEntryKind;
  title?: string;
  body?: string;
  bodyFormat?: BodyFormat;
  mood?: MoodId;
  moodNote?: string | null;
  tags?: string[];
  photoUris?: string[];
  voiceUri?: string | null;
  voiceDurationMs?: number | null;
  location?: JournalLocation | null;
}

/**
 * Purpose: whether a draft has enough content to persist (empty body is OK).
 * Inputs: draft-like fields from compose or quick mood check-in.
 * Outputs: true when body, title, moodNote, photos, or voice are present (mood alone is not enough).
 * Side effects: none.
 * Design decisions: quick mood check-ins save with mood + moodNote and blank body; media/title also qualify.
 */
export function journalDraftHasSavableContent(draft: {
  body?: string;
  title?: string;
  mood?: MoodId;
  moodNote?: string;
  photoUris?: string[];
  voiceUri?: string;
}): boolean {
  if ((draft.body ?? '').trim().length > 0) {
    return true;
  }
  if ((draft.title ?? '').trim().length > 0) {
    return true;
  }
  if ((draft.moodNote ?? '').trim().length > 0 && draft.mood) {
    return true;
  }
  if ((draft.photoUris?.length ?? 0) > 0) {
    return true;
  }
  return Boolean(draft.voiceUri);
}
