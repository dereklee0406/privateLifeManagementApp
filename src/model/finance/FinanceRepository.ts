import type { FinanceDocument } from './Account';

/**
 * Purpose: persistence port for the on-device personal finance document.
 * Inputs / outputs: FinanceDocument.
 * Side effects: implemented by the data layer.
 */
export interface FinanceRepository {
  load(): Promise<FinanceDocument>;
  save(document: FinanceDocument): Promise<void>;
}
