import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateSplitRemaining,
  createDefaultSplit,
  isSplitDraftValid,
  recalculateEqualShares,
  summarizeSplit,
  type ExpenseSplit,
  type ExpenseSplitShare,
} from './ExpenseSplit';

/**
 * Purpose: build a share row for unit fixtures without going through createDefaultSplit.
 * Inputs: id, name, amount, settlement flag.
 * Outputs: ExpenseSplitShare.
 * Side effects: none.
 */
function share(
  id: string,
  name: string,
  amount: number,
  isSettled = false,
): ExpenseSplitShare {
  return {
    id,
    name,
    amount,
    isSettled,
    ...(isSettled ? { settledAt: '2026-01-01T00:00:00.000Z' } : {}),
  };
}

describe('ExpenseSplit largest remainder', () => {
  it('splits $100 equally among 3 as 33.34, 33.33, 33.33 (sum === 100)', () => {
    const shares = recalculateEqualShares(100, [
      share('a', 'Me', 0, true),
      share('b', 'Friend', 0),
      share('c', 'Partner', 0),
    ]);
    assert.deepEqual(
      shares.map((row) => row.amount),
      [33.34, 33.33, 33.33],
    );
    const sum = shares.reduce((total, row) => total + row.amount, 0);
    assert.equal(Math.round(sum * 100) / 100, 100);
    assert.equal(calculateSplitRemaining(100, shares), 0);
  });

  it('splits $10 among 6 as four 1.67 and two 1.66', () => {
    const shares = recalculateEqualShares(10, [
      share('1', 'A', 0),
      share('2', 'B', 0),
      share('3', 'C', 0),
      share('4', 'D', 0),
      share('5', 'E', 0),
      share('6', 'F', 0),
    ]);
    const amounts = shares.map((row) => row.amount);
    assert.deepEqual(amounts, [1.67, 1.67, 1.67, 1.67, 1.66, 1.66]);
    assert.equal(
      amounts.filter((value) => value === 1.67).length,
      4,
    );
    assert.equal(
      amounts.filter((value) => value === 1.66).length,
      2,
    );
    assert.equal(calculateSplitRemaining(10, shares), 0);
  });
});

describe('ExpenseSplit equal vs custom allocation', () => {
  it('createDefaultSplit seeds equal mode with payer settled and balanced shares', () => {
    const draft = createDefaultSplit('exp-1', 90, 'HKD', ['Me', 'Alex', 'Sam']);
    assert.equal(draft.splitMode, 'equal');
    assert.equal(draft.shares.length, 3);
    assert.equal(draft.shares[0]?.isSettled, true);
    assert.equal(draft.shares[1]?.isSettled, false);
    assert.deepEqual(
      draft.shares.map((row) => row.amount),
      [30, 30, 30],
    );
    assert.equal(isSplitDraftValid(draft), true);
  });

  it('custom allocation validates when amounts sum to total and rejects over-allocation', () => {
    const balanced = {
      expenseId: 'exp-2',
      totalAmount: 100,
      currency: 'HKD' as const,
      splitMode: 'custom' as const,
      shares: [share('a', 'Me', 40, true), share('b', 'Friend', 60)],
    };
    assert.equal(calculateSplitRemaining(100, balanced.shares), 0);
    assert.equal(isSplitDraftValid(balanced), true);

    const over = {
      ...balanced,
      shares: [share('a', 'Me', 70, true), share('b', 'Friend', 40)],
    };
    assert.equal(calculateSplitRemaining(100, over.shares), -10);
    assert.equal(isSplitDraftValid(over), false);

    const under = {
      ...balanced,
      shares: [share('a', 'Me', 25, true), share('b', 'Friend', 25)],
    };
    assert.equal(calculateSplitRemaining(100, under.shares), 50);
    assert.equal(isSplitDraftValid(under), false);
  });

  it('rejects zero / negative totals and NaN-safe remaining without NaN', () => {
    const shares = [share('a', 'Me', 10, true), share('b', 'Friend', 10)];
    assert.equal(
      isSplitDraftValid({
        expenseId: 'exp-0',
        totalAmount: 0,
        currency: 'HKD',
        splitMode: 'equal',
        shares,
      }),
      false,
    );
    assert.equal(
      isSplitDraftValid({
        expenseId: 'exp-neg',
        totalAmount: -20,
        currency: 'HKD',
        splitMode: 'equal',
        shares,
      }),
      false,
    );
    const remaining = calculateSplitRemaining(Number.NaN, shares);
    assert.equal(Number.isNaN(remaining), false);
    assert.equal(remaining, -20);
  });
});

describe('ExpenseSplit settlement and remaining balance', () => {
  it('summarizeSplit tracks settlement toggle and pending amount', () => {
    const split: ExpenseSplit = {
      id: 'split-1',
      expenseId: 'exp-3',
      totalAmount: 100,
      currency: 'HKD',
      splitMode: 'equal',
      shares: [
        share('a', 'Me', 33.34, true),
        share('b', 'Friend', 33.33, false),
        share('c', 'Partner', 33.33, false),
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    let summary = summarizeSplit(split);
    assert.equal(summary.settledCount, 1);
    assert.equal(summary.totalCount, 3);
    assert.equal(summary.pendingAmount, 66.66);
    assert.equal(summary.allSettled, false);

    // Toggle Friend settled (UI writes isSettled / settledAt).
    split.shares = split.shares.map((row) =>
      row.id === 'b'
        ? { ...row, isSettled: true, settledAt: '2026-01-02T00:00:00.000Z' }
        : row,
    );
    summary = summarizeSplit(split);
    assert.equal(summary.settledCount, 2);
    assert.equal(summary.pendingAmount, 33.33);
    assert.equal(summary.allSettled, false);

    split.shares = split.shares.map((row) => ({
      ...row,
      isSettled: true,
      settledAt: row.settledAt ?? '2026-01-03T00:00:00.000Z',
    }));
    summary = summarizeSplit(split);
    assert.equal(summary.settledCount, 3);
    assert.equal(summary.pendingAmount, 0);
    assert.equal(summary.allSettled, true);
  });
});
