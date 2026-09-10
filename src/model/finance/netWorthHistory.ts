import type { MoneyCurrency } from '../settings/AppSettings';
import type { NetWorthSnapshot } from './netWorth';

/**
 * Purpose: one persisted monthly net-worth row (local history, not a live total).
 * Inputs: computeNetWorth snapshot + local calendar month.
 * Outputs: JSON row for Worth history.
 * Side effects: none.
 * Design decisions: one row per YYYY-MM. Live math stays in netWorth.ts; this file only
 *   upserts history. Persist on FinanceDocument with assets — backup stays one store.
 */
export interface NetWorthHistoryRow {
  monthKey: string;
  currency: MoneyCurrency;
  assets: number;
  loans: number;
  cardDebt: number;
  net: number;
  capturedAt: string;
}

/**
 * Purpose: local calendar month stamp (not UTC).
 * Inputs: Date (defaults unused — caller passes now).
 * Outputs: YYYY-MM in the device timezone.
 * Side effects: none.
 * Design decisions: matches leftover / budget months so “this month” is the phone’s month.
 */
export function monthKeyFromDate(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Purpose: build a history row from a live snapshot.
 * Inputs: live NetWorthSnapshot, capture clock.
 * Outputs: NetWorthHistoryRow for the local month of `now`.
 * Side effects: none.
 */
export function historyRowFromSnapshot(snapshot: NetWorthSnapshot, now: Date): NetWorthHistoryRow {
  return {
    monthKey: monthKeyFromDate(now),
    currency: snapshot.currency,
    assets: snapshot.assets,
    loans: snapshot.loans,
    cardDebt: snapshot.cardDebt,
    net: snapshot.net,
    capturedAt: now.toISOString(),
  };
}

/**
 * Purpose: insert or replace this month’s row; keep older months.
 * Inputs: existing history, live snapshot, now.
 * Outputs: newest-first list; at most one row per monthKey + currency.
 * Side effects: none.
 * Design decisions: revisit Worth in the same month overwrites the row (manual values move).
 *   Other currencies stay as separate series so a USD month does not clobber HKD.
 */
export function upsertMonthlySnapshot(
  history: NetWorthHistoryRow[],
  snapshot: NetWorthSnapshot,
  now: Date,
): NetWorthHistoryRow[] {
  const next = historyRowFromSnapshot(snapshot, now);
  const kept = history.filter((row) => !(row.monthKey === next.monthKey && row.currency === next.currency));
  return sortHistoryNewestFirst([next, ...kept]);
}

/**
 * Purpose: newest calendar month first, then currency for a stable list.
 * Inputs: history rows.
 * Outputs: new sorted array (does not mutate).
 * Side effects: none.
 */
export function sortHistoryNewestFirst(history: NetWorthHistoryRow[]): NetWorthHistoryRow[] {
  return [...history].sort((left, right) => {
    const byMonth = right.monthKey.localeCompare(left.monthKey);
    if (byMonth !== 0) {
      return byMonth;
    }
    return left.currency.localeCompare(right.currency);
  });
}

/**
 * Purpose: net change versus the previous month in the same currency.
 * Inputs: newest-first history, row index to compare.
 * Outputs: current.net − older.net, or undefined when no older sibling exists.
 * Side effects: none.
 */
export function snapshotDeltaVsPrevious(history: NetWorthHistoryRow[], index: number): number | undefined {
  const current = history[index];
  if (!current) {
    return undefined;
  }
  const previous = history.slice(index + 1).find((row) => row.currency === current.currency);
  if (!previous) {
    return undefined;
  }
  return current.net - previous.net;
}

/**
 * Purpose: hydrate one history row from finance JSON; drop junk.
 * Inputs: unknown parsed object.
 * Outputs: NetWorthHistoryRow or null.
 * Side effects: none.
 */
export function normalizeNetWorthHistoryRow(raw: unknown): NetWorthHistoryRow | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const value = raw as Record<string, unknown>;
  const monthKey = typeof value.monthKey === 'string' && /^\d{4}-\d{2}$/.test(value.monthKey) ? value.monthKey : null;
  const net = Number(value.net);
  const assets = Number(value.assets);
  const loans = Number(value.loans);
  const cardDebt = Number(value.cardDebt);
  if (!monthKey || !Number.isFinite(net) || !Number.isFinite(assets) || !Number.isFinite(loans) || !Number.isFinite(cardDebt)) {
    return null;
  }
  const currency: MoneyCurrency =
    value.currency === 'USD' || value.currency === 'CNY' || value.currency === 'HKD' ? value.currency : 'HKD';
  const capturedAt =
    typeof value.capturedAt === 'string' && !Number.isNaN(Date.parse(value.capturedAt))
      ? value.capturedAt
      : new Date().toISOString();
  return {
    monthKey,
    currency,
    assets: Math.max(0, assets),
    loans: Math.max(0, loans),
    cardDebt: Math.max(0, cardDebt),
    net,
    capturedAt,
  };
}

/**
 * Purpose: hydrate the history array; keep one row per month + currency (last write wins).
 * Inputs: unknown parsed field.
 * Outputs: newest-first NetWorthHistoryRow[].
 * Side effects: none.
 */
export function normalizeNetWorthHistory(raw: unknown): NetWorthHistoryRow[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const byKey = new Map<string, NetWorthHistoryRow>();
  for (const item of raw) {
    const row = normalizeNetWorthHistoryRow(item);
    if (!row) {
      continue;
    }
    byKey.set(`${row.monthKey}:${row.currency}`, row);
  }
  return sortHistoryNewestFirst([...byKey.values()]);
}
