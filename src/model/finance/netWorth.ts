import type { Asset } from './Asset';
import type { Loan } from './Loan';
import type { MoneyCurrency } from '../settings/AppSettings';

/**
 * Purpose: card debt input for net worth (balances only; amount-due is cash flow).
 */
export interface CardDebtInput {
  currentBalance?: number;
}

/**
 * Purpose: one-number net worth in a single currency (no FX).
 * Inputs: assets, loans, credit-card balances, reporting currency.
 * Outputs: sums plus net = assets − loans − card balances.
 * Side effects: none.
 * Design decisions: only asset/loan rows in `currency` count. Card debt uses currentBalance when set; amountDue stays a reminder cash-flow figure, not a balance-sheet posting.
 */
export interface NetWorthSnapshot {
  currency: MoneyCurrency;
  assets: number;
  loans: number;
  cardDebt: number;
  net: number;
  omittedOtherCurrency: boolean;
}

/**
 * Purpose: compute net worth without storing a derived total.
 * Inputs: assets, loans, card debt rows, currency.
 * Outputs: NetWorthSnapshot.
 * Side effects: none.
 */
export function computeNetWorth(
  assets: Asset[],
  loans: Loan[],
  cards: CardDebtInput[],
  currency: MoneyCurrency,
): NetWorthSnapshot {
  const assetSum = assets.filter((item) => item.currency === currency).reduce((sum, item) => sum + item.value, 0);
  const loanSum = loans.filter((item) => item.currency === currency).reduce((sum, item) => sum + item.balance, 0);
  const cardDebt = cards.reduce((sum, card) => {
    const balance = card.currentBalance;
    return sum + (typeof balance === 'number' && Number.isFinite(balance) ? Math.max(0, balance) : 0);
  }, 0);
  const omittedOtherCurrency =
    assets.some((item) => item.currency !== currency) || loans.some((item) => item.currency !== currency);
  return {
    currency,
    assets: assetSum,
    loans: loanSum,
    cardDebt,
    net: assetSum - loanSum - cardDebt,
    omittedOtherCurrency,
  };
}
