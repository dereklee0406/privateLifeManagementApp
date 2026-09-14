/**
 * Purpose: define the closed set of moods a journal entry can carry.
 * Inputs: none.
 * Outputs: MoodId union, MoodDefinition, and the catalog used by UI and stats.
 * Side effects: none.
 * Design decisions: four moods. Ids stay happy|neutral|sad|angry so storage is stable.
 *   UI language is Good / Steady / Off / Rough (i18n `mood.*`). English labels here are
 *   fallbacks only. Prompts are field-notebook, not spa.
 */
export type MoodId = 'happy' | 'neutral' | 'sad' | 'angry';

export interface MoodDefinition {
  id: MoodId;
  label: string;
  emoji: string;
  prompt: string;
}

export const MOODS: readonly MoodDefinition[] = [
  { id: 'happy', label: 'Good', emoji: '😊', prompt: 'What went well?' },
  { id: 'neutral', label: 'Steady', emoji: '😐', prompt: 'What held?' },
  { id: 'sad', label: 'Off', emoji: '😔', prompt: 'What was off?' },
  { id: 'angry', label: 'Rough', emoji: '😡', prompt: 'What was rough?' },
] as const;

const LEGACY_MOOD_MAP: Record<string, MoodId> = {
  radiant: 'happy',
  playful: 'happy',
  calm: 'neutral',
  focused: 'neutral',
  tender: 'sad',
  storm: 'angry',
};

/**
 * Purpose: look up a mood definition by id with a safe fallback.
 * Inputs: mood id, possibly unknown from older stored data.
 * Outputs: matching MoodDefinition, or Steady (neutral) when unknown.
 * Side effects: none.
 */
export function getMoodDefinition(moodId: string): MoodDefinition {
  const normalized = normalizeMoodId(moodId);
  return MOODS.find((mood) => mood.id === normalized) ?? MOODS[1];
}

/**
 * Purpose: coerce stored or legacy mood ids onto the four-mood catalog.
 * Inputs: any string from storage or drafts.
 * Outputs: a valid MoodId.
 * Side effects: none.
 */
export function normalizeMoodId(moodId: string): MoodId {
  if (moodId === 'happy' || moodId === 'neutral' || moodId === 'sad' || moodId === 'angry') {
    return moodId;
  }
  return LEGACY_MOOD_MAP[moodId] ?? 'neutral';
}

/**
 * Purpose: type guard for MoodId.
 * Inputs: unknown stored value.
 * Outputs: whether the value is a current MoodId.
 * Side effects: none.
 */
export function isMoodId(value: string): value is MoodId {
  return value === 'happy' || value === 'neutral' || value === 'sad' || value === 'angry';
}
