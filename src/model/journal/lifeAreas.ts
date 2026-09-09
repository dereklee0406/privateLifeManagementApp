import type { JournalEntry } from './JournalEntry';

export const LIFE_AREA_IDS = ['work', 'health', 'family', 'finance', 'travel'] as const;

export type NamedLifeAreaId = (typeof LIFE_AREA_IDS)[number];
export type LifeAreaId = NamedLifeAreaId | 'other';

export interface LifeAreaShare {
  id: LifeAreaId;
  label: string;
  count: number;
  percent: number;
}

const LABELS: Record<LifeAreaId, string> = {
  work: 'Work',
  health: 'Health',
  family: 'Family',
  finance: 'Finance',
  travel: 'Travel',
  other: 'Other',
};

const NAMED = new Set<string>(LIFE_AREA_IDS);

/**
 * Purpose: map a tag slug onto a life area (named five + other).
 * Inputs: normalized tag slug.
 * Outputs: life area id.
 * Side effects: none.
 */
export function lifeAreaForTag(tag: string): LifeAreaId {
  return NAMED.has(tag) ? (tag as NamedLifeAreaId) : 'other';
}

/**
 * Purpose: percent bars for How you’ve been from journal tags — no setup screen.
 * Inputs: journal entries.
 * Outputs: areas with at least one tag, percents of all tagged mentions; empty when she has no tags.
 * Side effects: none.
 * Design decisions: count tag mentions (a page with #work #family adds both); untagged pages do not invent Other.
 */
export function computeLifeAreas(entries: JournalEntry[]): LifeAreaShare[] {
  const counts = new Map<LifeAreaId, number>();
  let total = 0;
  for (const entry of entries) {
    for (const tag of entry.tags) {
      const area = lifeAreaForTag(tag);
      counts.set(area, (counts.get(area) ?? 0) + 1);
      total += 1;
    }
  }
  if (total === 0) {
    return [];
  }
  const rows: LifeAreaShare[] = [];
  for (const id of [...LIFE_AREA_IDS, 'other'] as LifeAreaId[]) {
    const count = counts.get(id) ?? 0;
    if (count === 0) {
      continue;
    }
    rows.push({
      id,
      label: LABELS[id],
      count,
      percent: Math.round((count / total) * 100),
    });
  }
  return rows.sort((left, right) => {
    if (left.id === 'other') {
      return 1;
    }
    if (right.id === 'other') {
      return -1;
    }
    return right.count - left.count;
  });
}
