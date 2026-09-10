import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Asset } from './Asset';
import {
  computeSavingsProgress,
  isSavingsTargetDraftValid,
  normalizeSavingsTarget,
  sumCashAndBank,
} from './savingsTarget';

/**
 * Purpose: minimal Asset fixture for savings-progress tests.
 * Inputs: id, kind, value, optional currency.
 * Outputs: Asset.
 * Side effects: none.
 */
function asset(
  id: string,
  kind: Asset['kind'],
  value: number,
  currency: Asset['currency'] = 'HKD',
): Asset {
  return {
    id,
    kind,
    name: id,
    value,
    currency,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

describe('sumCashAndBank', () => {
  it('sums cash and bank in the reporting currency and ignores holdings / FX', () => {
    const rows = [
      asset('cash', 'cash', 1000),
      asset('bank', 'bank', 4000),
      asset('etf', 'investment', 8000),
      asset('flat', 'property', 2_000_000),
      asset('usd', 'bank', 500, 'USD'),
    ];
    assert.equal(sumCashAndBank(rows, 'HKD'), 5000);
    assert.equal(sumCashAndBank(rows, 'USD'), 500);
  });
});

describe('computeSavingsProgress', () => {
  it('returns no target when the goal is missing or in another currency', () => {
    const rows = [asset('cash', 'cash', 200)];
    const none = computeSavingsProgress(undefined, rows, 'HKD');
    assert.equal(none.hasTarget, false);
    assert.equal(none.current, 200);
    assert.equal(none.met, false);

    const usdGoal = computeSavingsProgress(
      { amount: 1000, currency: 'USD', updatedAt: '2026-09-01T00:00:00.000Z' },
      rows,
      'HKD',
    );
    assert.equal(usdGoal.hasTarget, false);
  });

  it('computes remaining and met against cash + bank only', () => {
    const rows = [asset('cash', 'cash', 300), asset('bank', 'bank', 700), asset('etf', 'investment', 5000)];
    const mid = computeSavingsProgress(
      { amount: 2000, currency: 'HKD', updatedAt: '2026-09-01T00:00:00.000Z' },
      rows,
      'HKD',
    );
    assert.equal(mid.hasTarget, true);
    assert.equal(mid.current, 1000);
    assert.equal(mid.remaining, 1000);
    assert.equal(mid.ratio, 0.5);
    assert.equal(mid.met, false);

    const done = computeSavingsProgress(
      { amount: 1000, currency: 'HKD', updatedAt: '2026-09-01T00:00:00.000Z' },
      rows,
      'HKD',
    );
    assert.equal(done.met, true);
    assert.equal(done.remaining, 0);
    assert.equal(done.ratio, 1);
  });
});

describe('isSavingsTargetDraftValid / normalizeSavingsTarget', () => {
  it('rejects zero and junk, hydrates a valid row', () => {
    assert.equal(isSavingsTargetDraftValid({ amount: 0, currency: 'HKD' }), false);
    assert.equal(isSavingsTargetDraftValid({ amount: 50, currency: 'HKD' }), true);
    assert.equal(normalizeSavingsTarget(null), undefined);
    assert.equal(normalizeSavingsTarget({ amount: 'nope' }), undefined);
    const row = normalizeSavingsTarget({ amount: 12000, currency: 'HKD', updatedAt: '2026-09-10T00:00:00.000Z' });
    assert.deepEqual(row, { amount: 12000, currency: 'HKD', updatedAt: '2026-09-10T00:00:00.000Z' });
  });
});
