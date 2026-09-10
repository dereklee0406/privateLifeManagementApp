/**
 * Purpose: tagged on-device prompt library (Today / Gratitude / Review / Focus).
 * Inputs: catalog ids; Date for the daily rotation.
 * Outputs: PromptId strings; View localizes via `prompts.*`.
 * Side effects: none.
 * Design decisions: ids are stable so i18n can move without changing rotation. Field-notebook
 *   voice lives in catalogs, not here. No Gratitude tab — packs are a picker only.
 *   getDailyPrompt stays the Today/date hash so Android and iOS share the same invitation.
 */

export const PROMPT_PACKS = ['today', 'gratitude', 'review', 'focus'] as const;

export type PromptPack = (typeof PROMPT_PACKS)[number];

export type PromptId = string;

export interface PromptCatalogEntry {
  id: PromptId;
  pack: PromptPack;
}

const TODAY_IDS = [
  'today.noticed',
  'today.conversation',
  'today.temperature',
  'today.protected',
  'today.sentence',
  'today.unfinished',
  'today.ordinary',
  'today.kind',
  'today.yesterday',
  'today.ritual',
  'today.carrying',
  'today.color',
] as const;

const GRATITUDE_IDS = [
  'gratitude.thanked',
  'gratitude.worked',
  'gratitude.kept',
  'gratitude.enough',
  'gratitude.person',
  'gratitude.returned',
] as const;

const REVIEW_IDS = [
  'review.held',
  'review.drop',
  'review.repeat',
  'review.money',
  'review.unfinished',
  'review.learn',
] as const;

const FOCUS_IDS = [
  'focus.one',
  'focus.protect',
  'focus.no',
  'focus.next',
  'focus.aim',
  'focus.done',
] as const;

const PACK_IDS: Record<PromptPack, readonly string[]> = {
  today: TODAY_IDS,
  gratitude: GRATITUDE_IDS,
  review: REVIEW_IDS,
  focus: FOCUS_IDS,
};

/**
 * Purpose: full library in pack order for the picker sheet.
 * Inputs: none.
 * Outputs: catalog rows (id + pack).
 * Side effects: none.
 */
export const PROMPT_CATALOG: readonly PromptCatalogEntry[] = PROMPT_PACKS.flatMap((pack) =>
  PACK_IDS[pack].map((id) => ({ id, pack })),
);

const PROMPT_ID_SET = new Set(PROMPT_CATALOG.map((row) => row.id));

/**
 * Purpose: ids in one pack for grouped UI.
 * Inputs: pack id.
 * Outputs: PromptId[] in catalog order.
 * Side effects: none.
 */
export function promptsInPack(pack: PromptPack): PromptId[] {
  return [...PACK_IDS[pack]];
}

/**
 * Purpose: guard a compose/query string before looking up i18n.
 * Inputs: unknown id.
 * Outputs: true when it is in the catalog.
 * Side effects: none.
 */
export function isPromptId(value: string): boolean {
  return PROMPT_ID_SET.has(value);
}

/**
 * Purpose: pick a stable Today-pack prompt for a local calendar day.
 * Inputs: date (defaults to now).
 * Outputs: PromptId from the Today pack (View translates `prompts.{id}`).
 * Side effects: none.
 * Design decisions: same date-hash as the old English list so a given civil day stays put
 *   across Android/iOS. Rotation is Today only — library picks are user-chosen.
 */
export function getDailyPrompt(now: Date = new Date()): PromptId {
  const seed = now.getFullYear() * 1000 + (now.getMonth() + 1) * 50 + now.getDate();
  return TODAY_IDS[seed % TODAY_IDS.length];
}
