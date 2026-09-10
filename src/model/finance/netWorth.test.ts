import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Asset } from './Asset';
import type { Loan } from './Loan';
import { computeNetWorth } from './netWorth';
import {
  historyRowFromSnapshot,
  monthKeyFromDate,
  normalizeNetWorthHistory,
  snapshotDeltaVsPrevious,
  upsertMonthlySnapshot,
} from './netWorthHistory';

/**
 * Purpose: minimal Asset fixture for live net-worth tests.
 * Inputs: id, value, optional currency / kind.
 * Outputs: Asset.
 * Side effects: none.
 */
function asset(id: string, value: number, currency: Asset['currency'] = 'HKD'): Asset {
  return {
    id,
    kind: 'cash',
    name: id,
    value,
    currency,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

/**
 * Purpose: minimal Loan fixture for live net-worth tests.
 * Inputs: id, balance, optional currency.
 * Outputs: Loan.
 * Side effects: none.
 */
function loan(id: string, balance: number, currency: Loan['currency'] = 'HKD'): Loan {
  return {
    id,
    kind: 'personal',
    name: id,
    balance,
    currency,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('computeNetWorth', () => {
  it('nets assets minus loans minus card balances in one currency', () => {
    const snap = computeNetWorth(
      [asset('a', 10_000), asset('usd', 100, 'USD')],
      [loan('l', 2_000)],
      [{ currentBalance: 500 }, { currentBalance: undefined }],
      'HKD',
    );
    assert.equal(snap.assets, 10_000);
    assert.equal(snap.loans, 2_000);
    assert.equal(snap.cardDebt, 500);
    assert.equal(snap.net, 7500);
    assert.equal(snap.omittedOtherCurrency, true);
  });
});

describe('monthKeyFromDate / upsertMonthlySnapshot', () => {
  it('stamps the local calendar month and upserts one row per month + currency', () => {
    assert.equal(monthKeyFromDate(new Date(2026, 8, 10)), '2026-09');

    const live = computeNetWorth([asset('a', 1000)], [], [], 'HKD');
    const first = upsertMonthlySnapshot([], live, new Date(2026, 8, 10, 9));
    assert.equal(first.length, 1);
    assert.equal(first[0]?.monthKey, '2026-09');
    assert.equal(first[0]?.net, 1000);

    const later = computeNetWorth([asset('a', 1500)], [], [], 'HKD');
    const sameMonth = upsertMonthlySnapshot(first, later, new Date(2026, 8, 20, 18));
    assert.equal(sameMonth.length, 1);
    assert.equal(sameMonth[0]?.net, 1500);

    const october = computeNetWorth([asset('a', 1800)], [loan('l', 200)], [{ currentBalance: 50 }], 'HKD');
    const two = upsertMonthlySnapshot(sameMonth, october, new Date(2026, 9, 1));
    assert.equal(two.length, 2);
    assert.equal(two[0]?.monthKey, '2026-10');
    assert.equal(two[0]?.net, 1550);
    assert.equal(two[1]?.monthKey, '2026-09');
    assert.equal(snapshotDeltaVsPrevious(two, 0), 50);
    assert.equal(snapshotDeltaVsPrevious(two, 1), undefined);
  });

  it('keeps a parallel series when currency differs', () => {
    const hkd = historyRowFromSnapshot(computeNetWorth([asset('a', 100)], [], [], 'HKD'), new Date(2026, 8, 1));
    const usdLive = computeNetWorth([asset('u', 20, 'USD')], [], [], 'USD');
    const mixed = upsertMonthlySnapshot([hkd], usdLive, new Date(2026, 8, 1));
    assert.equal(mixed.length, 2);
    assert.equal(mixed.some((row) => row.currency === 'HKD' && row.net === 100), true);
    assert.equal(mixed.some((row) => row.currency === 'USD' && row.net === 20), true);
  });
});

describe('normalizeNetWorthHistory', () => {
  it('drops junk and collapses duplicate month + currency keys', () => {
    const rows = normalizeNetWorthHistory([
      { monthKey: '2026-08', currency: 'HKD', assets: 10, loans: 1, cardDebt: 0, net: 9, capturedAt: '2026-08-31T00:00:00.000Z' },
      { monthKey: '2026-08', currency: 'HKD', assets: 12, loans: 1, cardDebt: 0, net: 11, capturedAt: '2026-08-31T12:00:00.000Z' },
      { monthKey: 'bad', net: 1 },
      null,
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.net, 11);
    assert.deepEqual(normalizeNetWorthHistory(null), []);
  });
});
