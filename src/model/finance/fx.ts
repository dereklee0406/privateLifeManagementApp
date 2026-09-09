import type { MoneyCurrency } from '../settings/AppSettings';
import { evaluateAmountExpression, formatEvaluatedAmount } from './amountCalculator';
import { formatFriendlyMoney, type Expense, type ExpenseFxSnapshot } from './Expense';
import { toDayKey } from '../../utils/dateUtils';

const MONEY_CURRENCIES: MoneyCurrency[] = ['HKD', 'USD', 'CNY'];

/**
 * Purpose: cached FX snapshot — quotes only, never spend amounts.
 * Inputs: public latest-rate feed (Frankfurter/ECB) plus local fetchedAt.
 * Outputs: JSON-serializable table keyed by quote currency vs `base`.
 * Side effects: none.
 * Design decisions: `quotes[code]` means 1 `base` = that many `code`. Identity (from === to) does not need a table.
 */
export interface FxRateTable {
  base: MoneyCurrency;
  quotes: Partial<Record<MoneyCurrency, number>>;
  fetchedAt: string;
}

/**
 * Purpose: mid-market ballpark when cache/network has not hydrated yet (USD triangulation like Frankfurter).
 * Inputs: none — compile-time ECB-style approx (1 USD ≈ 7.8 HKD, ≈ 7.2 CNY).
 * Outputs: always-usable FxRateTable so keypad currency chips never leave the face amount stuck.
 * Side effects: none.
 * Design decisions: epoch `fetchedAt` marks it as non-live; live GET / AsyncStorage replace it when available.
 *   100 HKD → ~12.82 USD → ~92.3 CNY → ~100 HKD.
 */
export const BASELINE_FX_TABLE: FxRateTable = {
  base: 'USD',
  quotes: { USD: 1, HKD: 7.8, CNY: 7.2 },
  fetchedAt: '1970-01-01T00:00:00.000Z',
};

/**
 * Purpose: never hand a null/empty table to converters — keypad and save must not fail silently.
 * Inputs: optional live/cached table.
 * Outputs: usable table (caller’s table when it can quote all Halo codes, else baseline).
 * Side effects: none.
 */
export function resolveFxTable(table: FxRateTable | null | undefined): FxRateTable {
  if (!table) {
    return BASELINE_FX_TABLE;
  }
  for (const code of MONEY_CURRENCIES) {
    if (code === table.base) {
      continue;
    }
    const rate = table.quotes[code];
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
      return BASELINE_FX_TABLE;
    }
  }
  return table;
}

/**
 * Purpose: validate stored or fetched FX JSON.
 * Inputs: unknown parse result.
 * Outputs: FxRateTable or null when unusable.
 * Side effects: none.
 * Design decisions: keep Model free of HTTP; drop unknown currencies (no EUR/GBP in Halo).
 */
export function normalizeFxRateTable(raw: unknown): FxRateTable | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const value = raw as Record<string, unknown>;
  const base = MONEY_CURRENCIES.includes(value.base as MoneyCurrency) ? (value.base as MoneyCurrency) : null;
  if (!base || typeof value.fetchedAt !== 'string' || Number.isNaN(Date.parse(value.fetchedAt))) {
    return null;
  }
  const source = value.quotes;
  if (!source || typeof source !== 'object') {
    return null;
  }
  const quotes: Partial<Record<MoneyCurrency, number>> = {};
  for (const code of MONEY_CURRENCIES) {
    const rate = (source as Record<string, unknown>)[code];
    if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
      quotes[code] = rate;
    }
  }
  quotes[base] = quotes[base] ?? 1;
  return { base, quotes, fetchedAt: value.fetchedAt };
}

/** Dual-line estimate is always HKD for HK users, even when You currency is USD or CNY. */
export const ESTIMATE_CURRENCY: MoneyCurrency = 'HKD';

/**
 * Purpose: convert one amount between Halo currencies using a rate table.
 * Inputs: amount, from/to codes, optional table, optional card-fee fraction (Visa/MC-style markup).
 * Outputs: rounded amount in `to`, or undefined when the pair is missing (caller shows original only).
 * Side effects: none.
 * Design decisions: same-currency is a no-op without a network; triangulation is via table.base (USD from ECB).
 *   Null/incomplete tables fall back to `BASELINE_FX_TABLE` via `resolveFxTable` (never silent no-op on keypad).
 *   Fee applies only when converting into HKD from another code: `hkdEstimate = mid * (1 + feeRate)`.
 *   USD/CNY home totals pass the same feeRate but stay mid-market because `to !== HKD`.
 */
export function convertAmount(
  amount: number,
  from: MoneyCurrency,
  to: MoneyCurrency,
  table: FxRateTable | null | undefined,
  feeRate = 0,
): number | undefined {
  if (!Number.isFinite(amount)) {
    return undefined;
  }
  if (from === to) {
    return amount;
  }
  const rates = resolveFxTable(table);
  const fromRate = ratePerBase(from, rates);
  const toRate = ratePerBase(to, rates);
  if (fromRate === undefined || toRate === undefined) {
    return undefined;
  }
  const converted = (amount / fromRate) * toRate;
  const charged = to === ESTIMATE_CURRENCY && feeRate > 0 ? converted * (1 + feeRate) : converted;
  if (!Number.isFinite(charged)) {
    return undefined;
  }
  return Math.round(charged * 100) / 100;
}

/**
 * Purpose: when she switches HKD|USD|CNY on the amount keypad, evaluate then mid-market convert.
 * Inputs: current expression, from/to codes, optional rate table (no card fee — keypad is face amount).
 * Outputs: next expression string for the well.
 * Side effects: none.
 * Design decisions: empty stays empty; `0` stays `0`; expressions like `10+5` collapse to the converted
 *   total. Uses `resolveFxTable` so a null cache still converts via baseline (never leave face amount stuck).
 *   Same-currency is a no-op. Round via formatEvaluatedAmount (≤2 dp, no trailing zeros).
 */
export function convertAmountExpression(
  expression: string,
  from: MoneyCurrency,
  to: MoneyCurrency,
  table: FxRateTable | null | undefined,
): string {
  if (from === to) {
    return expression;
  }
  if (!expression) {
    return '';
  }
  const value = evaluateAmountExpression(expression);
  if (!Number.isFinite(value)) {
    return expression;
  }
  if (value === 0) {
    return '0';
  }
  const converted = convertAmount(value, from, to, resolveFxTable(table), 0);
  if (converted === undefined) {
    return formatEvaluatedAmount(value);
  }
  return formatEvaluatedAmount(converted);
}

/**
 * Purpose: girlfriend-facing percent for “incl. card 1.5%”.
 * Inputs: fee fraction (0.015).
 * Outputs: `1.5%` / `2%` / `3%` / `0%`.
 * Side effects: none.
 */
export function formatCardFeePercent(feeRate: number): string {
  const pct = feeRate * 100;
  const body = Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
  return `${body}%`;
}

/**
 * Purpose: girlfriend-facing spend label — original, plus estimated HKD when the spend is not HKD.
 * Inputs: stored amount + currency, You home currency (unused for the dual line), live rate table + fee for
 *   compose, optional locked snapshot for saved rows, optional feeCopy for Log a spend.
 * Outputs: `HK$12` or `US$12 ≈ HK$95.90` or `US$12 ≈ HK$95.90 incl. card 1.5%`.
 * Side effects: none.
 * Design decisions: dual line is always estimated HKD, not You currency. Saved rows pass `snapshot` and skip
 *   the live table so the number cannot drift. Compose omits snapshot and uses the live table. Same-currency
 *   HKD stays a single amount. This is an estimate, not a bank posting.
 */
export function formatSpendLine(
  amount: number,
  spendCurrency: MoneyCurrency,
  _homeCurrency: MoneyCurrency,
  table: FxRateTable | null | undefined,
  feeRate = 0,
  opts?: { feeCopy?: boolean; inclCard?: string; snapshot?: Pick<Expense, 'homeAmount' | 'quoteCurrency' | 'cardFeeRate'> | null },
): string {
  const original = formatFriendlyMoney(amount, spendCurrency);
  if (spendCurrency === ESTIMATE_CURRENCY) {
    return original;
  }
  const locked = opts?.snapshot;
  const estimated =
    locked && locked.quoteCurrency === ESTIMATE_CURRENCY && typeof locked.homeAmount === 'number' && Number.isFinite(locked.homeAmount)
      ? locked.homeAmount
      : convertAmount(amount, spendCurrency, ESTIMATE_CURRENCY, table, feeRate);
  if (estimated === undefined) {
    return original;
  }
  const dual = `${original} ≈ ${formatFriendlyMoney(estimated, ESTIMATE_CURRENCY)}`;
  const shownFee = locked && typeof locked.cardFeeRate === 'number' ? locked.cardFeeRate : feeRate;
  if (opts?.feeCopy && shownFee > 0) {
    const suffix = opts.inclCard ?? `incl. card ${formatCardFeePercent(shownFee)}`;
    return `${dual} ${suffix}`;
  }
  return dual;
}

/**
 * Purpose: list/Calendar label for a saved spend — locked HKD, never live FX.
 * Inputs: persisted expense.
 * Outputs: same dual-line shape as compose, using `homeAmount` when present.
 * Side effects: none.
 * Design decisions: missing snapshot shows original only (backfill writes the lock on read).
 */
export function formatExpenseSpendLine(expense: Expense): string {
  return formatSpendLine(expense.amount, expense.currency, ESTIMATE_CURRENCY, undefined, 0, { snapshot: expense });
}

/**
 * Purpose: mid-market units of `to` per 1 `from` (no card fee).
 * Inputs: pair plus a rate table.
 * Outputs: positive number, or undefined when the pair is missing.
 * Side effects: none.
 * Design decisions: stored on Expense.fxRate as HKD per 1 spend unit at save.
 */
export function quoteRate(
  from: MoneyCurrency,
  to: MoneyCurrency,
  table: FxRateTable | null | undefined,
): number | undefined {
  if (from === to) {
    return 1;
  }
  const rates = resolveFxTable(table);
  const fromRate = ratePerBase(from, rates);
  const toRate = ratePerBase(to, rates);
  if (fromRate === undefined || toRate === undefined) {
    return undefined;
  }
  return toRate / fromRate;
}

/**
 * Purpose: lock one foreign spend into HKD at save (or one-time backfill).
 * Inputs: original amount + currency, live/cached table, card-fee fraction, conversion clock.
 * Outputs: snapshot, or undefined for HKD only (baseline fills a missing live table).
 * Side effects: none.
 * Design decisions: `homeAmount` is fee-inclusive when fee is on; `fxRate` is mid HKD per 1 spend unit.
 *   Always resolve via `resolveFxTable` so foreign save never skips the HKD lock when the network is cold.
 */
export function buildExpenseFxSnapshot(
  amount: number,
  spendCurrency: MoneyCurrency,
  table: FxRateTable | null | undefined,
  cardFeeRate: number,
  convertedAt: Date | string,
): ExpenseFxSnapshot | undefined {
  if (spendCurrency === ESTIMATE_CURRENCY) {
    return undefined;
  }
  const rates = resolveFxTable(table);
  const homeAmount = convertAmount(amount, spendCurrency, ESTIMATE_CURRENCY, rates, cardFeeRate);
  const fxRate = quoteRate(spendCurrency, ESTIMATE_CURRENCY, rates);
  if (homeAmount === undefined || fxRate === undefined) {
    return undefined;
  }
  const at = typeof convertedAt === 'string' ? convertedAt : convertedAt.toISOString();
  return {
    homeAmount,
    quoteCurrency: 'HKD',
    fxRate,
    cardFeeRate: cardFeeRate > 0 ? cardFeeRate : 0,
    convertedAt: at,
  };
}

/**
 * Purpose: whether a saved row already has a locked HKD number.
 * Inputs: expense.
 * Outputs: true when homeAmount is usable.
 * Side effects: none.
 */
export function hasExpenseFxSnapshot(expense: Expense): boolean {
  return (
    expense.currency !== ESTIMATE_CURRENCY &&
    expense.quoteCurrency === ESTIMATE_CURRENCY &&
    typeof expense.homeAmount === 'number' &&
    Number.isFinite(expense.homeAmount)
  );
}

/**
 * Purpose: detect legacy foreign spends that still float on live rates.
 * Inputs: expense.
 * Outputs: true when we should convert once and persist.
 * Side effects: none.
 */
export function expenseNeedsFxSnapshot(expense: Expense): boolean {
  return expense.currency !== ESTIMATE_CURRENCY && !hasExpenseFxSnapshot(expense);
}

/**
 * Purpose: reporting amount for totals — same-currency amount, or locked HKD, never live convert.
 * Inputs: saved expense, You / reporting currency.
 * Outputs: amount in `currency`, or undefined when this row cannot contribute without live FX.
 * Side effects: none.
 * Design decisions: HKD totals use `homeAmount`. Same-currency uses `amount`. No Frankfurter on saved rows.
 */
export function spendAmountIn(expense: Expense, currency: MoneyCurrency): number | undefined {
  if (expense.currency === currency) {
    return expense.amount;
  }
  if (currency === ESTIMATE_CURRENCY && hasExpenseFxSnapshot(expense)) {
    return expense.homeAmount;
  }
  if (expense.quoteCurrency === currency && typeof expense.homeAmount === 'number' && Number.isFinite(expense.homeAmount)) {
    return expense.homeAmount;
  }
  return undefined;
}

/**
 * Purpose: clock (and date if not today) for Rates from / Rates updated copy.
 * Inputs: ISO fetchedAt, now, optional Intl locale.
 */
export function formatRatesClock(fetchedAt: string, now: Date = new Date(), locale?: string): string {
  const at = new Date(fetchedAt);
  const time = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(at);
  if (toDayKey(at) === toDayKey(now)) {
    return time;
  }
  const day = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(at);
  return `${day}, ${time}`;
}

/**
 * Purpose: stale-cache caption on Money when the live feed failed.
 * Inputs: ISO fetchedAt, now, optional locale (English “Rates from” kept as fallback).
 * Outputs: `Rates from 2:15 PM` — views should wrap with t('money.ratesFrom').
 */
export function ratesFromLabel(fetchedAt: string, now: Date = new Date(), locale?: string): string {
  return `Rates from ${formatRatesClock(fetchedAt, now, locale)}`;
}

/**
 * Purpose: quiet You-tab line under Money currency.
 */
export function ratesUpdatedLabel(fetchedAt: string, now: Date = new Date(), locale?: string): string {
  return `Rates updated ${formatRatesClock(fetchedAt, now, locale)}`;
}

/**
 * Purpose: skip a network round-trip when the cache is still useful.
 * Inputs: table, now, max age in ms.
 * Outputs: true when fetchedAt is within the window.
 * Side effects: none.
 * Design decisions: ECB publishes once per business day; hours (not minutes) is enough for “latest”.
 */
export function fxTableIsFresh(table: FxRateTable, now: Date, maxAgeMs: number): boolean {
  const fetched = Date.parse(table.fetchedAt);
  if (Number.isNaN(fetched)) {
    return false;
  }
  return now.getTime() - fetched < maxAgeMs;
}

function ratePerBase(code: MoneyCurrency, table: FxRateTable): number | undefined {
  if (code === table.base) {
    return 1;
  }
  const rate = table.quotes[code];
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    return undefined;
  }
  return rate;
}
