import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppConfig } from '../config/appConfig';
import type { JournalEntry } from '../model/journal/JournalEntry';
import type { JournalRepository } from '../model/journal/JournalRepository';
import { normalizeEntries } from '../model/journal/normalizeEntry';
import { createSeedEntries } from './seedEntries';

/**
 * Purpose: persist journal pages locally so the app works offline on Android and iOS.
 * Inputs: JournalEntry arrays.
 * Outputs: loaded arrays, seeding on first launch, migrating older six-mood records.
 * Side effects: AsyncStorage read/write of JSON metadata only.
 * Design decisions: JSON document store keeps the first version simple; media bytes live in the document directory / IndexedDB, never in this key.
 */
export class JournalLocalStore implements JournalRepository {
  /**
   * Purpose: read all pages, seeding sample writing when the store is empty.
   */
  async loadAll(): Promise<JournalEntry[]> {
    const raw = await AsyncStorage.getItem(AppConfig.storage.entriesKey);
    if (!raw) {
      const seeded = createSeedEntries();
      await this.saveAll(seeded);
      return seeded;
    }
    try {
      return normalizeEntries(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  /**
   * Purpose: replace the stored journal document.
   */
  async saveAll(entries: JournalEntry[]): Promise<void> {
    await AsyncStorage.setItem(AppConfig.storage.entriesKey, JSON.stringify(entries));
  }
}
