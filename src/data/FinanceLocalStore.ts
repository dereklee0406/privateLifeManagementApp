import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppConfig } from '../config/appConfig';
import { emptyFinanceDocument, type FinanceDocument } from '../model/finance/Account';
import { normalizeFinanceDocument } from '../model/finance/normalizeFinance';
import type { FinanceRepository } from '../model/finance/FinanceRepository';

/**
 * Purpose: persist personal finance JSON on this device (no bank tokens).
 * Inputs: FinanceDocument.
 * Outputs: loaded document.
 * Side effects: AsyncStorage write/read.
 */
export class FinanceLocalStore implements FinanceRepository {
  async load(): Promise<FinanceDocument> {
    const raw = await AsyncStorage.getItem(AppConfig.storage.financeKey);
    if (!raw) {
      return emptyFinanceDocument();
    }
    try {
      return normalizeFinanceDocument(JSON.parse(raw));
    } catch {
      return emptyFinanceDocument();
    }
  }

  async save(document: FinanceDocument): Promise<void> {
    await AsyncStorage.setItem(AppConfig.storage.financeKey, JSON.stringify(document));
  }
}
