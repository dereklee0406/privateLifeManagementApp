import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateAmountExpression, formatEvaluatedAmount } from './amountCalculator';
import {
  BASELINE_FX_TABLE,
  buildExpenseFxSnapshot,
  convertAmount,
  convertAmountExpression,
  quoteRate,
  resolveFxTable,
} from './fx';

describe('BASELINE_FX_TABLE', () => {
  it('quotes USD triangulation ballpark rates', () => {
    assert.equal(BASELINE_FX_TABLE.base, 'USD');
    assert.equal(BASELINE_FX_TABLE.quotes.USD, 1);
    assert.equal(BASELINE_FX_TABLE.quotes.HKD, 7.8);
    assert.equal(BASELINE_FX_TABLE.quotes.CNY, 7.2);
    assert.equal(BASELINE_FX_TABLE.fetchedAt, '1970-01-01T00:00:00.000Z');
  });

  it('resolveFxTable falls back to baseline for null or incomplete tables', () => {
    assert.equal(resolveFxTable(null), BASELINE_FX_TABLE);
    assert.equal(resolveFxTable(undefined), BASELINE_FX_TABLE);
    assert.equal(
      resolveFxTable({ base: 'USD', quotes: { USD: 1, HKD: 7.8 }, fetchedAt: '2026-01-01T00:00:00.000Z' }),
      BASELINE_FX_TABLE,
    );
  });
});

describe('FX evaluate + convert', () => {
  it('evaluates expressions and formats amounts for keypad conversion', () => {
    // Left-to-right shop math: (45 + 12) × 2 = 114 (not PEMDAS).
    assert.equal(evaluateAmountExpression('45+12×2'), 114);
    assert.equal(formatEvaluatedAmount(12.5), '12.5');
    assert.equal(formatEvaluatedAmount(12), '12');
    assert.equal(formatEvaluatedAmount(12.34), '12.34');

    assert.equal(convertAmountExpression('100', 'USD', 'HKD', null), '780');
    assert.equal(convertAmountExpression('10+5', 'USD', 'HKD', BASELINE_FX_TABLE), '117');
    assert.equal(convertAmountExpression('', 'USD', 'HKD', null), '');
  });

  it('converts 100 USD to 780 HKD at baseline mid-market (TC-ENG-10)', () => {
    assert.equal(convertAmount(100, 'USD', 'HKD', BASELINE_FX_TABLE), 780);
    assert.equal(quoteRate('USD', 'HKD', BASELINE_FX_TABLE), 7.8);
  });
});

describe('FX snapshot lock with foreign fee', () => {
  it('locks fee-inclusive HKD onto the transaction snapshot (TC-ENG-11)', () => {
    const snapshot = buildExpenseFxSnapshot(
      100,
      'USD',
      BASELINE_FX_TABLE,
      0.0195,
      '2026-03-15T12:00:00.000Z',
    );
    assert.ok(snapshot, 'expected FX snapshot for USD spend');
    assert.equal(snapshot!.quoteCurrency, 'HKD');
    assert.equal(snapshot!.fxRate, 7.8);
    assert.equal(snapshot!.cardFeeRate, 0.0195);
    assert.equal(snapshot!.convertedAt, '2026-03-15T12:00:00.000Z');
    // Mid 780 * 1.0195 = 795.21
    assert.equal(snapshot!.homeAmount, 795.21);
    assert.equal(convertAmount(100, 'USD', 'HKD', BASELINE_FX_TABLE, 0.0195), 795.21);
  });

  it('skips snapshot lock for HKD spends', () => {
    assert.equal(
      buildExpenseFxSnapshot(50, 'HKD', BASELINE_FX_TABLE, 0.015, new Date('2026-03-15T12:00:00.000Z')),
      undefined,
    );
  });
});
