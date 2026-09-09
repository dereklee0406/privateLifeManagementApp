import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppConfig } from '../config/appConfig';
import { normalizeReminderDocument } from '../model/reminders/normalizeReminder';
import type { ReminderDocumentPort, ReminderRepository } from '../model/reminders/ReminderRepository';

/**
 * Purpose: persist reminders and credit-card accounts as one JSON document (not the lock PIN).
 * Inputs: ReminderDocumentPort.
 * Outputs: loaded document.
 * Side effects: AsyncStorage read/write.
 */
export class RemindersLocalStore implements ReminderRepository {
  /**
   * Purpose: load reminders and cards; legacy array documents still read.
   */
  async load(): Promise<ReminderDocumentPort> {
    const raw = await AsyncStorage.getItem(AppConfig.storage.remindersKey);
    if (!raw) {
      return { reminders: [], creditCards: [] };
    }
    try {
      return normalizeReminderDocument(JSON.parse(raw));
    } catch {
      return { reminders: [], creditCards: [] };
    }
  }

  /**
   * Purpose: replace the stored reminder document.
   */
  async save(document: ReminderDocumentPort): Promise<void> {
    await AsyncStorage.setItem(AppConfig.storage.remindersKey, JSON.stringify(document));
  }
}
