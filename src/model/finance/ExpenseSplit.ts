import type { MoneyCurrency } from '../settings/AppSettings';
import { createId } from '../../utils/idUtils';

export type ExpenseSplitMode = 'equal' | 'custom';

/**
 * Purpose: one participant's share of a split expense.
 * Inputs: split form / settlement toggles.
 * Outputs: JSON-serializable share row.
 * Side effects: none.
 * Design decisions: amount is money in the parent split's currency; settlement is local truth only.
 */
export interface ExpenseSplitShare {
  id: string;
  name: string;
  amount: number;
  isSettled: boolean;
  settledAt?: string;
}

/**
 * Purpose: on-device split of one spend among friends/family.
 * Inputs: FinanceController save/load.
 * Outputs: JSON row keyed by expenseId (one active split per spend).
 * Side effects: none.
 * Design decisions: not a ledger — shares are facts for settlement tracking; totals are derived in helpers.
 */
export interface ExpenseSplit {
  id: string;
  expenseId: string;
  totalAmount: number;
  currency: MoneyCurrency;
  splitMode: ExpenseSplitMode;
  shares: ExpenseSplitShare[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Purpose: create/update payload for a split before persistence.
 * Inputs: ExpenseSplitScreen form state.
 * Outputs: draft consumed by FinanceController.saveSplit.
 * Side effects: none.
 * Design decisions: optional id updates an existing split; otherwise controller upserts by expenseId.
 */
export interface ExpenseSplitDraft {
  id?: string;
  expenseId: string;
  totalAmount: number;
  currency: MoneyCurrency;
  splitMode: ExpenseSplitMode;
  shares: ExpenseSplitShare[];
}

const CENT = 100;
const CENT_EPS = 0.005;

/**
 * Purpose: round money to whole cents.
 * Inputs: raw amount.
 * Outputs: two-decimal money (or 0 when non-finite).
 * Side effects: none.
 */
function roundMoney(amount: number): number {
  if (!Number.isFinite(amount)) {
    return 0;
  }
  return Math.round(amount * CENT) / CENT;
}

/**
 * Purpose: seed an equal-split draft from participant names.
 * Inputs: expense id, total, currency, ordered participant labels (first is typically "Me").
 * Outputs: ExpenseSplitDraft in equal mode with cent-safe share amounts.
 * Side effects: none.
 * Design decisions: first participant starts settled (payer); others pending. Generates share ids for UI keys.
 */
export function createDefaultSplit(
  expenseId: string,
  totalAmount: number,
  currency: MoneyCurrency,
  participants: string[],
): ExpenseSplitDraft {
  const names = participants.map((name) => name.trim()).filter(Boolean);
  const safeNames = names.length >= 2 ? names : names.length === 1 ? [...names, 'Friend'] : ['Me', 'Friend'];
  const shares: ExpenseSplitShare[] = safeNames.map((name, index) => ({
    id: createId(),
    name,
    amount: 0,
    isSettled: index === 0,
    settledAt: index === 0 ? new Date().toISOString() : undefined,
  }));
  return {
    expenseId,
    totalAmount: Math.max(0, roundMoney(totalAmount)),
    currency,
    splitMode: 'equal',
    shares: recalculateEqualShares(totalAmount, shares),
  };
}

/**
 * Purpose: divide total into whole-cent shares without leftover rounding error.
 * Inputs: total amount and existing shares (ids/names/settlement preserved).
 * Outputs: new share array with equal (or near-equal) amounts summing to total.
 * Side effects: none.
 * Design decisions: largest-remainder on cents — first `remainder` shares get +1 cent (e.g. 100/3 → 33.34, 33.33, 33.33).
 */
export function recalculateEqualShares(totalAmount: number, shares: ExpenseSplitShare[]): ExpenseSplitShare[] {
  if (shares.length === 0) {
    return [];
  }
  const totalCents = Math.max(0, Math.round(roundMoney(totalAmount) * CENT));
  const base = Math.floor(totalCents / shares.length);
  const remainder = totalCents % shares.length;
  return shares.map((share, index) => ({
    ...share,
    amount: (base + (index < remainder ? 1 : 0)) / CENT,
  }));
}

/**
 * Purpose: how much of the total is still unallocated across shares.
 * Inputs: total and current shares.
 * Outputs: remaining (positive = under-allocated, negative = over).
 * Side effects: none.
 */
export function calculateSplitRemaining(totalAmount: number, shares: ExpenseSplitShare[]): number {
  const allocated = shares.reduce((sum, share) => sum + (Number.isFinite(share.amount) ? share.amount : 0), 0);
  return roundMoney(roundMoney(totalAmount) - allocated);
}

/**
 * Purpose: gate Save on a complete, balanced split draft.
 * Inputs: draft from the split form.
 * Outputs: true when expense, participants, and cent balance are valid.
 * Side effects: none.
 * Design decisions: require ≥2 named shares; amounts ≥0; |remaining| within half a cent.
 */
export function isSplitDraftValid(draft: ExpenseSplitDraft): boolean {
  if (!draft.expenseId?.trim()) {
    return false;
  }
  if (!Number.isFinite(draft.totalAmount) || draft.totalAmount <= 0) {
    return false;
  }
  if (!Array.isArray(draft.shares) || draft.shares.length < 2) {
    return false;
  }
  for (const share of draft.shares) {
    if (!share.name?.trim()) {
      return false;
    }
    if (!Number.isFinite(share.amount) || share.amount < 0) {
      return false;
    }
  }
  return Math.abs(calculateSplitRemaining(draft.totalAmount, draft.shares)) < CENT_EPS;
}

/**
 * Purpose: settlement progress for chips and banners.
 * Inputs: persisted ExpenseSplit.
 * Outputs: settled/total counts, pending amount, and allSettled flag.
 * Side effects: none.
 * Design decisions: pendingAmount sums unsettled share amounts only.
 */
export function summarizeSplit(split: ExpenseSplit): {
  settledCount: number;
  totalCount: number;
  pendingAmount: number;
  allSettled: boolean;
} {
  const totalCount = split.shares.length;
  const settledCount = split.shares.filter((share) => share.isSettled).length;
  const pendingAmount = roundMoney(
    split.shares.filter((share) => !share.isSettled).reduce((sum, share) => sum + share.amount, 0),
  );
  return {
    settledCount,
    totalCount,
    pendingAmount,
    allSettled: totalCount > 0 && settledCount === totalCount,
  };
}
