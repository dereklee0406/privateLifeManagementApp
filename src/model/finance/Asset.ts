import type { MoneyCurrency } from '../settings/AppSettings';

/**
 * Purpose: simple on-device asset kinds (not a depreciation schedule).
 */
export type AssetKind = 'cash' | 'bank' | 'investment' | 'property';

export const ASSET_KINDS: Array<{ id: AssetKind; label: string }> = [
  { id: 'cash', label: 'Cash' },
  { id: 'bank', label: 'Bank' },
  { id: 'investment', label: 'Investment' },
  { id: 'property', label: 'Property' },
];

/**
 * Purpose: a named asset with a typed current value.
 * Inputs: Money tab asset form.
 * Outputs: JSON row for net worth.
 * Side effects: none.
 * Design decisions: current value is manual; no bank login. Credit cards are debt, not assets.
 */
export interface Asset {
  id: string;
  kind: AssetKind;
  name: string;
  value: number;
  currency: MoneyCurrency;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetDraft {
  kind: AssetKind;
  name: string;
  value: number;
  currency: MoneyCurrency;
  note?: string;
}
