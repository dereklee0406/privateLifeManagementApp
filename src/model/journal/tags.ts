/**
 * Purpose: suggested tag catalog for journal chips.
 * Inputs: none.
 * Outputs: canonical tag slugs shown as #work #health #family #finance #travel.
 * Side effects: none.
 * Design decisions: slugs are lowercase without the hash so storage stays simple; views prefix #.
 */
export const SUGGESTED_TAGS: readonly string[] = ['work', 'health', 'family', 'finance', 'travel'];

/**
 * Purpose: normalize a single tag slug.
 * Inputs: free-typed chip text.
 * Outputs: lowercase slug without #, or empty if blank.
 * Side effects: none.
 */
export function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#/, '').toLowerCase();
}

/**
 * Purpose: dedupe and cap a tag list.
 * Inputs: raw tags from a draft.
 * Outputs: unique slugs, max 8.
 * Side effects: none.
 */
export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map(normalizeTag).filter(Boolean))].slice(0, 8);
}
