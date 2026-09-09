import { AppConfig } from '../../config/appConfig';

/**
 * Purpose: cap and empty-out an optional mood context line on a journal page.
 * Inputs: unknown stored or typed value.
 * Outputs: trimmed string ≤ 80 chars, or undefined when blank (old pages migrate empty).
 * Side effects: none.
 * Design decisions: undefined (not "") so search and cards treat missing and blank the same.
 */
export function normalizeMoodNote(raw: unknown): string | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const trimmed = raw.trim().slice(0, AppConfig.writing.maxMoodNoteLength);
  return trimmed || undefined;
}
