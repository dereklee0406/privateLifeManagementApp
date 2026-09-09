import { getLocales } from 'expo-localization';

/**
 * Purpose: read the phone language tag for Follow phone.
 * Inputs: none (OS locale list).
 * Outputs: BCP-47 tag such as en-HK, or en when the list is empty.
 * Side effects: none.
 * Design decisions: expo-localization stays in this native file so web Metro never resolves it.
 */
export function deviceLanguageTag(): string {
  try {
    return getLocales()[0]?.languageTag ?? 'en';
  } catch {
    return 'en';
  }
}
