import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppConfig } from '../config/appConfig';
import type { AppSettings } from '../model/settings/AppSettings';
import type { SettingsRepository } from '../model/settings/SettingsRepository';

/**
 * Purpose: persist writer settings locally.
 * Inputs: AppSettings or none on first launch.
 * Outputs: stored settings or null when unset.
 * Side effects: AsyncStorage read/write.
 */
export class SettingsLocalStore implements SettingsRepository {
  async load(): Promise<AppSettings | null> {
    const raw = await AsyncStorage.getItem(AppConfig.storage.settingsKey);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AppSettings;
    } catch {
      return null;
    }
  }

  async save(settings: AppSettings): Promise<void> {
    await AsyncStorage.setItem(AppConfig.storage.settingsKey, JSON.stringify(settings));
  }
}
