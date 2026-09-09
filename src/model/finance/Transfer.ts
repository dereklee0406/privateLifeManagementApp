import type { MoneyCurrency } from '../settings/AppSettings';

/**
 * Purpose: record an on-device fund transfer between two assets or an asset and a card.
 * Inputs: transfer form in Money flow.
 * Outputs: persisted fact in FinanceDocument.
 * Side effects: none.
 * Design decisions: transfers adjust source and destination asset values atomically without
 *   requiring bank synchronization or complex double-entry ledgers.
 */
export interface TransferEntry {
  id: string;
  fromAssetId: string;
  toAssetId?: string;
  toCardId?: string;
  amount: number;
  currency: MoneyCurrency;
  fee?: number;
  dayKey: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransferDraft {
  fromAssetId: string;
  toAssetId?: string;
  toCardId?: string;
  amount: number;
  currency: MoneyCurrency;
  fee?: number;
  dayKey: string;
  note?: string;
}

/**
 * Purpose: validate whether a transfer draft is ready to save.
 * Inputs: draft and optional list of existing asset IDs.
 * Outputs: boolean.
 * Side effects: none.
 * Design decisions: transfer must have a valid positive amount, a source asset, and at least one
 *   distinct destination (asset or credit card).
 */
export function isTransferDraftValid(draft: TransferDraft, assetIds: string[] = []): boolean {
  if (!Number.isFinite(draft.amount) || draft.amount <= 0) {
    return false;
  }
  if (!draft.fromAssetId || draft.fromAssetId.trim().length === 0) {
    return false;
  }
  const hasToAsset = Boolean(draft.toAssetId && draft.toAssetId.trim().length > 0);
  const hasToCard = Boolean(draft.toCardId && draft.toCardId.trim().length > 0);
  if (!hasToAsset && !hasToCard) {
    return false;
  }
  // Cannot transfer to the exact same asset
  if (hasToAsset && draft.fromAssetId === draft.toAssetId) {
    return false;
  }
  if (assetIds.length > 0 && !assetIds.includes(draft.fromAssetId)) {
    return false;
  }
  return true;
}
