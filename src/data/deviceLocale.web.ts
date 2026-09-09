/**
 * Purpose: read the browser language tag for Follow phone without expo-localization.
 * Inputs: none (navigator when the DOM exists).
 * Outputs: BCP-47 tag such as en-US, or en when navigator is missing (SSR / odd runtimes).
 * Side effects: none.
 * Design decisions: Metro web cannot resolve expo-localization; this stub keeps i18n working with en as fallback.
 */
export function deviceLanguageTag(): string {
  try {
    if (typeof navigator === 'undefined') {
      return 'en';
    }
    const tag = navigator.languages?.[0] || navigator.language;
    if (typeof tag === 'string' && tag.trim()) {
      return tag;
    }
  } catch {
    return 'en';
  }
  return 'en';
}
