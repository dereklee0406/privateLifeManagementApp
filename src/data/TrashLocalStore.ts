import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppConfig } from '../config/appConfig';
import { emptyTrashDocument, type TrashDocument, type TrashItem } from '../model/trash/TrashItem';
import { type TrashRepository, upsertTrashItem } from '../model/trash/TrashRepository';

/**
 * Purpose: persist Recently deleted pages and spends on this device.
 * Inputs: TrashDocument.
 * Outputs: loaded document; corrupt JSON becomes empty (no crash).
 * Side effects: AsyncStorage read/write.
 */
export class TrashLocalStore implements TrashRepository {
  async load(): Promise<TrashDocument> {
    const raw = await AsyncStorage.getItem(AppConfig.storage.trashKey);
    if (!raw) {
      return emptyTrashDocument();
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return emptyTrashDocument();
      }
      const value = parsed as { items?: unknown };
      const items = Array.isArray(value.items)
        ? value.items.filter((item): item is TrashItem => Boolean(item && typeof item === 'object' && typeof (item as TrashItem).id === 'string'))
        : [];
      return { items };
    } catch {
      return emptyTrashDocument();
    }
  }

  async save(document: TrashDocument): Promise<void> {
    await AsyncStorage.setItem(AppConfig.storage.trashKey, JSON.stringify(document));
  }

  /**
   * Purpose: convenience stash used by journal/finance deletes.
   */
  async stash(item: TrashItem): Promise<void> {
    const current = await this.load();
    await this.save(upsertTrashItem(current, item));
  }
}
