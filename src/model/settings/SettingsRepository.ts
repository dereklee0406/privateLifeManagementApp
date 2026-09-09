import type { AppSettings } from './AppSettings';

/**
 * Purpose: persistence port for app settings.
 * Inputs / outputs: AppSettings records.
 * Side effects: implemented by the data layer.
 */
export interface SettingsRepository {
  load(): Promise<AppSettings | null>;
  save(settings: AppSettings): Promise<void>;
}
