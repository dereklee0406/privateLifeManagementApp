import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { NetWorthHistoryRow } from './netWorthHistory';
import { netWorthSparkSeries, sparkBarRatios } from './netWorthSparkline';

/**
 * Purpose: one history row for sparkline tests.
 * Inputs: month key, net, optional currency.
 * Outputs: NetWorthHistoryRow.
 * Side effects: none.
 */
function row(monthKey: string, net: number, currency: NetWorthHistoryRow['currency'] = 'HKD'): NetWorthHistoryRow {
  return {
    monthKey,
    currency,
    assets: Math.max(0, net),
    loans: 0,
    cardDebt: 0,
    net,
    capturedAt: `${monthKey}-15T00:00:00.000Z`,
  };
}

describe('netWorthSparkSeries', () => {
  it('returns oldest-first home-currency points and omits other currencies', () => {
    const series = netWorthSparkSeries(
      [row('2026-09', 3000), row('2026-07', 1000), row('2026-08', 2000), row('2026-08', 99, 'USD')],
      'HKD',
    );
    assert.deepEqual(
      series.map((point) => point.monthKey),
      ['2026-07', '2026-08', '2026-09'],
    );
    assert.deepEqual(
      series.map((point) => point.net),
      [1000, 2000, 3000],
    );
  });

  it('returns empty when history has no home-currency rows', () => {
    assert.deepEqual(netWorthSparkSeries([row('2026-09', 1, 'USD')], 'HKD'), []);
    assert.deepEqual(netWorthSparkSeries([], 'HKD'), []);
  });

  it('caps at 12 months (oldest of the window dropped)', () => {
    const history = Array.from({ length: 14 }, (_, index) => {
      const month = index + 1;
      const year = month <= 12 ? 2025 : 2026;
      const key = `${year}-${String(((month - 1) % 12) + 1).padStart(2, '0')}`;
      return row(key, month * 10);
    });
    const series = netWorthSparkSeries(history, 'HKD');
    assert.equal(series.length, 12);
  });
});

describe('sparkBarRatios', () => {
  it('normalizes min–max with a floor, and flattens equal nets', () => {
    const shaped = sparkBarRatios([
      { monthKey: '2026-07', net: 100 },
      { monthKey: '2026-08', net: 200 },
      { monthKey: '2026-09', net: 300 },
    ]);
    assert.equal(shaped[0], 0.12);
    assert.ok((shaped[2] ?? 0) > (shaped[1] ?? 0));
    assert.equal(shaped[2], 1);
    assert.deepEqual(sparkBarRatios([{ monthKey: '2026-09', net: 50 }]), [0.5]);
    assert.deepEqual(sparkBarRatios([]), []);
  });
});
