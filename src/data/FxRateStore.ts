import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppConfig } from '../config/appConfig';
import { normalizeFxRateTable, type FxRateTable } from '../model/finance/fx';

/**
 * Purpose: persist the last FX snapshot on this device.
 * Inputs: FxRateTable (quotes + fetchedAt only).
 * Outputs: cached table or null.
 * Side effects: AsyncStorage read/write under fxRatesKey.
 * Design decisions: never store spend amounts, notes, or identity — cache is rates only.
 */
export class FxRateStore {
  async load(): Promise<FxRateTable | null> {
    const raw = await AsyncStorage.getItem(AppConfig.storage.fxRatesKey);
    if (!raw) {
      return null;
    }
    try {
      return normalizeFxRateTable(JSON.parse(raw) as unknown);
    } catch {
      return null;
    }
  }

  async save(table: FxRateTable): Promise<void> {
    await AsyncStorage.setItem(AppConfig.storage.fxRatesKey, JSON.stringify(table));
  }
}
