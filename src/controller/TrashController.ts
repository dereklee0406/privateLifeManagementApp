import { removeMediaFile } from '../data/mediaStore';
import { isTrashExpired, type TrashItem } from '../model/trash/TrashItem';
import type { TrashRepository } from '../model/trash/TrashRepository';

/**
 * Purpose: Recently deleted list, restore, and 30-day purge.
 * Inputs: TrashRepository; restore writes go through journal/finance controllers via the caller.
 * Outputs: live (non-expired) trash rows.
 * Side effects: JSON write; media delete only on purge.
 */
export class TrashController {
  constructor(private readonly repository: TrashRepository) {}

  /**
   * Purpose: drop expired rows (and their media) then return what she can still restore.
   */
  async listLive(now: Date = new Date()): Promise<TrashItem[]> {
    const document = await this.repository.load();
    const live: TrashItem[] = [];
    const expired: TrashItem[] = [];
    for (const item of document.items) {
      if (isTrashExpired(item, now)) {
        expired.push(item);
      } else {
        live.push(item);
      }
    }
    if (expired.length > 0) {
      await Promise.all(expired.map((item) => dropTrashMedia(item)));
      await this.repository.save({ items: live });
    }
    return live;
  }

  async restore(id: string): Promise<TrashItem | null> {
    const document = await this.repository.load();
    const item = document.items.find((row) => row.id === id) ?? null;
    if (!item) {
      return null;
    }
    await this.repository.save({ items: document.items.filter((row) => row.id !== id) });
    return item;
  }
}

async function dropTrashMedia(item: TrashItem): Promise<void> {
  if (item.page) {
    await Promise.all(item.page.photoUris.map((uri) => removeMediaFile(uri)));
    if (item.page.voiceUri) {
      await removeMediaFile(item.page.voiceUri);
    }
  }
  if (item.spend) {
    await Promise.all(item.spend.photoUris.map((uri) => removeMediaFile(uri)));
  }
}
