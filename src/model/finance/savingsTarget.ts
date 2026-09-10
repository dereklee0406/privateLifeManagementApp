import type { Asset, AssetKind } from './Asset';
import type { MoneyCurrency } from '../settings/AppSettings';

/** Asset kinds that count toward the savings pile (cash you can spend). */
const LIQUID_KINDS: readonly AssetKind[] = ['cash', 'bank'];

/**
 * Purpose: a typed savings goal stored with the finance document.
 * Inputs: Worth → Savings target form.
 * Outputs: JSON row compared to cash + bank (not investments).
 * Side effects: none.
 * Design decisions: lives on FinanceDocument — assets already persist there, so backup/restore
 *   stays one store. Settings JSON would split the Worth story across two files.
 */
export interface SavingsTarget {
  amount: number;
  currency: MoneyCurrency;
  updatedAt: string;
}

export interface SavingsTargetDraft {
  amount: number;
  currency: MoneyCurrency;
}

/**
 * Purpose: glanceable progress for the Worth savings card.
 * Inputs: optional target, liquid sum, reporting currency.
 * Outputs: current / goal / remaining / ratio (0–1+) and whether a goal exists.
 * Side effects: none.
 */
export interface SavingsProgress {
  currency: MoneyCurrency;
  hasTarget: boolean;
  goal: number;
  current: number;
  remaining: number;
  ratio: number;
  met: boolean;
}

/**
 * Purpose: sum cash + bank in one currency for the savings bar.
 * Inputs: asset rows, reporting currency.
 * Outputs: non-negative total; investment / property / other currencies are ignored.
 * Side effects: none.
 * Design decisions: savings is the spendable pile, not net worth. A brokerage number is an
 *   asset kind with a typed value — it does not fill this bar.
 */
export function sumCashAndBank(assets: Asset[], currency: MoneyCurrency): number {
  return assets
    .filter((item) => LIQUID_KINDS.includes(item.kind) && item.currency === currency)
    .reduce((sum, item) => sum + (Number.isFinite(item.value) ? Math.max(0, item.value) : 0), 0);
}

/**
 * Purpose: compare a savings goal to cash + bank without storing a derived percent.
 * Inputs: optional target, assets, reporting currency (home wallet).
 * Outputs: SavingsProgress; hasTarget is false when amount is missing or not finite.
 * Side effects: none.
 * Design decisions: progress uses the reporting currency, not the stored target currency, so the
 *   bar matches the Worth hero. Cross-currency cash is omitted (same rule as net worth).
 */
export function computeSavingsProgress(
  target: SavingsTarget | undefined,
  assets: Asset[],
  currency: MoneyCurrency,
): SavingsProgress {
  const current = sumCashAndBank(assets, currency);
  const goal = target && target.currency === currency && Number.isFinite(target.amount) ? Math.max(0, target.amount) : 0;
  const hasTarget = goal > 0;
  const remaining = hasTarget ? Math.max(0, goal - current) : 0;
  const ratio = hasTarget ? current / goal : 0;
  return {
    currency,
    hasTarget,
    goal,
    current,
    remaining,
    ratio,
    met: hasTarget && current >= goal,
  };
}

/**
 * Purpose: accept a typed goal from the Worth form.
 * Inputs: draft amount + currency.
 * Outputs: true when amount is a finite number greater than 0.
 * Side effects: none.
 */
export function isSavingsTargetDraftValid(draft: SavingsTargetDraft): boolean {
  return Number.isFinite(draft.amount) && draft.amount > 0;
}

/**
 * Purpose: hydrate a savings goal from finance JSON; drop junk.
 * Inputs: unknown parsed field.
 * Outputs: SavingsTarget or undefined.
 * Side effects: none.
 */
export function normalizeSavingsTarget(raw: unknown): SavingsTarget | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const value = raw as Record<string, unknown>;
  const amount = Number(value.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return undefined;
  }
  const currency: MoneyCurrency =
    value.currency === 'USD' || value.currency === 'CNY' || value.currency === 'HKD' ? value.currency : 'HKD';
  const updatedAt =
    typeof value.updatedAt === 'string' && !Number.isNaN(Date.parse(value.updatedAt))
      ? value.updatedAt
      : new Date().toISOString();
  return {
    amount: Math.max(0, amount),
    currency,
    updatedAt,
  };
}
