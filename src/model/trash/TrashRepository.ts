import type { TrashDocument, TrashItem } from './TrashItem';

/**
 * Purpose: persistence port for Recently deleted (pages and spends).
 * Inputs / outputs: TrashDocument.
 * Side effects: implemented by the data layer.
 */
export interface TrashRepository {
  load(): Promise<TrashDocument>;
  save(document: TrashDocument): Promise<void>;
}

/**
 * Purpose: stash a row, replacing any older trash with the same id.
 * Inputs: current document plus the new item.
 * Outputs: document with the item at the front.
 * Side effects: none.
 */
export function upsertTrashItem(document: TrashDocument, item: TrashItem): TrashDocument {
  return {
    items: [item, ...document.items.filter((row) => row.id !== item.id)],
  };
}
