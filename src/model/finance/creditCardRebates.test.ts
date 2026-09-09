import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CreditCardAccount } from '../reminders/creditCards';
import { BASELINE_FX_TABLE } from './fx';
import {
  calculateTransactionRebate,
  findBestCardForSpend,
  getCardBillingCycleWindow,
  groupCardsByBank,
  POPULAR_CARD_PRESETS,
} from './creditCardRebates';

/**
 * Purpose: build a minimal CreditCardAccount for rebate engine fixtures.
 * Inputs: partial overrides on top of a stable base card.
 * Outputs: CreditCardAccount.
 * Side effects: none.
 */
function card(partial: Partial<CreditCardAccount> & Pick<CreditCardAccount, 'id' | 'name'>): CreditCardAccount {
  return {
    dueDayOfMonth: 25,
    statementDayOfMonth: 5,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    baseRebateRate: 0.004,
    ...partial,
  };
}

describe('calculateTransactionRebate', () => {
  it('uses category bonus rate when matched, else falls back to base rate', () => {
    const diningCard = card({
      id: 'card-dining',
      name: 'Dining Card',
      baseRebateRate: 0.004,
      rebateRules: [
        {
          id: 'dining-5',
          category: 'dining',
          rebateRate: 0.05,
          monthlySpendCap: 10000,
          description: '5% dining',
        },
      ],
    });

    const dining = calculateTransactionRebate(diningCard, 1000, 'dining', '2026-03-15', []);
    assert.equal(dining.matchedRuleId, 'dining-5');
    assert.equal(dining.baseRebate, 4);
    assert.equal(dining.bonusRebate, 46);
    assert.equal(dining.rebateAmount, 50);
    assert.ok(Math.abs(dining.effectiveRate - 0.05) < 1e-9);

    const other = calculateTransactionRebate(diningCard, 1000, 'transport', '2026-03-15', []);
    assert.equal(other.matchedRuleId, undefined);
    assert.equal(other.bonusRebate, 0);
    assert.equal(other.baseRebate, 4);
    assert.equal(other.rebateAmount, 4);
  });

  it('enforces min spend per transaction (DBS Eminent $300 dining)', () => {
    const preset = POPULAR_CARD_PRESETS.find((row) => row.id === 'dbs-eminent');
    assert.ok(preset, 'dbs-eminent preset must exist');
    const dbs = card({
      id: 'dbs-1',
      name: preset!.name,
      bankId: preset!.bankId,
      baseRebateRate: preset!.baseRebateRate,
      rebateRules: preset!.rebateRules,
      monthlyRebateCap: preset!.monthlyRebateCap,
      minMonthlySpendRequirement: undefined,
    });

    const below = calculateTransactionRebate(dbs, 250, 'dining', '2026-03-15', []);
    assert.equal(below.matchedRuleId, undefined);
    assert.equal(below.bonusRebate, 0);
    assert.equal(below.baseRebate, 2.5);
    assert.equal(below.rebateAmount, 2.5);

    const above = calculateTransactionRebate(dbs, 350, 'dining', '2026-03-15', []);
    assert.equal(above.matchedRuleId, 'dbs-em-dining');
    assert.equal(above.baseRebate, 3.5);
    assert.equal(above.bonusRebate, 14);
    assert.equal(above.rebateAmount, 17.5);
  });

  it('requires min monthly spend before unlocking accelerated rates', () => {
    const gated = card({
      id: 'gated-1',
      name: 'Gated Card',
      baseRebateRate: 0.004,
      minMonthlySpendRequirement: 5000,
      rebateRules: [
        {
          id: 'dining-5',
          category: 'dining',
          rebateRate: 0.05,
          monthlySpendCap: 10000,
          description: '5% dining',
        },
      ],
    });

    const prior = [
      { amount: 2000, category: 'groceries', cardId: 'gated-1', dayKey: '2026-03-01' },
    ];
    const locked = calculateTransactionRebate(gated, 1000, 'dining', '2026-03-15', prior);
    assert.equal(locked.matchedRuleId, undefined);
    assert.equal(locked.bonusRebate, 0);
    assert.equal(locked.rebateAmount, 4);
    assert.match(locked.explanation, /5000/);

    const unlockedPrior = [
      { amount: 4500, category: 'groceries', cardId: 'gated-1', dayKey: '2026-03-01' },
    ];
    const unlocked = calculateTransactionRebate(gated, 1000, 'dining', '2026-03-15', unlockedPrior);
    assert.equal(unlocked.matchedRuleId, 'dining-5');
    assert.equal(unlocked.rebateAmount, 50);
  });

  it('splits spend into bonus vs base when monthly spend cap is reached (TC-ENG-04)', () => {
    const capped = card({
      id: 'cap-1',
      name: 'Cap Card',
      baseRebateRate: 0.004,
      rebateRules: [
        {
          id: 'dining-5',
          category: 'dining',
          rebateRate: 0.05,
          monthlySpendCap: 6000,
          monthlyRebateCap: 300,
          description: '5% dining capped',
        },
      ],
    });

    const result = calculateTransactionRebate(capped, 7000, 'dining', '2026-03-15', []);
    assert.equal(result.isCapExceeded, true);
    assert.equal(result.baseRebate, 28);
    // 6000 at bonus delta (5% - 0.4%) = 276; total = 28 + 276 = 304, but rule rebate cap 300 clamps bonus.
    // Engine clamps bonus-eligible by remaining rebate room: (300) / (0.046) ≈ 6521.74 → still spend-cap limited to 6000 → 276 bonus.
    // With monthlyRebateCap on rule: remainingRebate starts at 300; 6000 * 0.046 = 276 < 300, so bonus = 276.
    assert.equal(result.bonusRebate, 276);
    assert.equal(result.rebateAmount, 304);
    assert.equal(result.capRemaining, 0);
  });

  it('applies bank promo only inside date window with registration and clamps promo cap', () => {
    const promoCard = card({
      id: 'promo-1',
      name: 'Promo Card',
      baseRebateRate: 0.01,
      promotions: [
        {
          id: 'spring-dining',
          title: 'Spring dining +3%',
          category: 'dining',
          extraRebateRate: 0.03,
          startDate: '2026-03-01',
          endDate: '2026-03-31',
          maxRebateCap: 50,
          requiresRegistration: true,
          isRegistered: false,
        },
      ],
    });

    const unregistered = calculateTransactionRebate(promoCard, 1000, 'dining', '2026-03-15', []);
    assert.equal(unregistered.matchedPromoId, undefined);
    assert.equal(unregistered.promoRebate, 0);

    const registered = {
      ...promoCard,
      promotions: [{ ...promoCard.promotions![0]!, isRegistered: true }],
    };

    const outside = calculateTransactionRebate(registered, 1000, 'dining', '2026-04-15', []);
    assert.equal(outside.matchedPromoId, undefined);

    const inside = calculateTransactionRebate(registered, 1000, 'dining', '2026-03-15', []);
    assert.equal(inside.matchedPromoId, 'spring-dining');
    assert.equal(inside.promoRebate, 30);
    assert.equal(inside.baseRebate, 10);
    assert.equal(inside.rebateAmount, 40);

    const nearCap = calculateTransactionRebate(registered, 2000, 'dining', '2026-03-20', [
      { amount: 1000, category: 'dining', cardId: 'promo-1', dayKey: '2026-03-10' },
    ]);
    // Prior promo used ≈ 30; remaining cap 20; 2000 * 3% = 60 → clamped to 20.
    assert.equal(nearCap.matchedPromoId, 'spring-dining');
    assert.equal(nearCap.promoRebate, 20);
  });

  it('enforces lower limits (min spend per tx & total spend) and upper limits (max spend cap) on promotions', () => {
    const promoCard = card({
      id: 'promo-limits-card',
      name: 'Limits Card',
      baseRebateRate: 0.01,
      promotions: [
        {
          id: 'tiered-promo',
          title: 'Mega Promo +5%',
          category: 'all',
          extraRebateRate: 0.05,
          startDate: '2026-03-01',
          endDate: '2026-03-31',
          minSpendPerTx: 500, // Lower limit: $500 per transaction
          minTotalSpend: 3000, // Lower limit: $3,000 total accumulated spend
          maxSpendCap: 5000, // Upper limit: $5,000 spend cap
          maxRebateCap: 300, // Upper limit: $300 rebate cap
          requiresRegistration: false,
          isRegistered: true,
        },
      ],
    });

    // 1. Below per-transaction lower limit ($400 < $500) -> no promo rebate
    const belowTxMin = calculateTransactionRebate(promoCard, 400, 'dining', '2026-03-15', [
      { amount: 3500, category: 'shopping', cardId: 'promo-limits-card', dayKey: '2026-03-05' },
    ]);
    assert.equal(belowTxMin.matchedPromoId, undefined);
    assert.equal(belowTxMin.promoRebate, 0);

    // 2. Below total accumulated spend lower limit (spend + prior < $3000) -> no promo rebate
    const belowTotalMin = calculateTransactionRebate(promoCard, 600, 'dining', '2026-03-15', [
      { amount: 1000, category: 'shopping', cardId: 'promo-limits-card', dayKey: '2026-03-05' },
    ]);
    assert.equal(belowTotalMin.matchedPromoId, undefined);
    assert.equal(belowTotalMin.promoRebate, 0);

    // 3. Meets both lower limits ($800 >= $500, and $2500 + $800 = $3300 >= $3000) -> earns +5% promo rebate
    const qualified = calculateTransactionRebate(promoCard, 800, 'dining', '2026-03-15', [
      { amount: 2500, category: 'shopping', cardId: 'promo-limits-card', dayKey: '2026-03-05' },
    ]);
    assert.equal(qualified.matchedPromoId, 'tiered-promo');
    assert.equal(qualified.promoRebate, 40); // 800 * 0.05 = 40

    // 4. Clamps to maxSpendCap ($5000) when prior eligible spend was $4500
    // Remaining eligible spend = 5000 - 4500 = 500 -> 500 * 0.05 = 25
    const cappedBySpend = calculateTransactionRebate(promoCard, 1000, 'dining', '2026-03-20', [
      { amount: 4500, category: 'dining', cardId: 'promo-limits-card', dayKey: '2026-03-05' },
    ]);
    assert.equal(cappedBySpend.matchedPromoId, 'tiered-promo');
    assert.equal(cappedBySpend.promoRebate, 25);

    // 5. Clamps to maxRebateCap ($300) when prior rebate earned is already $280 ($5600 spend capped at $5000 spend -> 5000 * 0.05 = 250... let's test rebate cap directly with lower rebate cap)
    const rebateCappedCard = card({
      id: 'promo-rebate-capped',
      name: 'Rebate Cap Card',
      baseRebateRate: 0.01,
      promotions: [
        {
          id: 'rebate-capped-promo',
          title: 'Rebate Capped +5%',
          category: 'all',
          extraRebateRate: 0.05,
          startDate: '2026-03-01',
          endDate: '2026-03-31',
          maxRebateCap: 100, // Upper limit: $100 max rebate
          requiresRegistration: false,
          isRegistered: true,
        },
      ],
    });
    // Prior eligible spend = 1600; prior rebate used = 1600 * 0.05 = 80; remaining rebate = 100 - 80 = 20
    const cappedByRebate = calculateTransactionRebate(rebateCappedCard, 1000, 'dining', '2026-03-25', [
      { amount: 1600, category: 'dining', cardId: 'promo-rebate-capped', dayKey: '2026-03-05' },
    ]);
    assert.equal(cappedByRebate.matchedPromoId, 'rebate-capped-promo');
    assert.equal(cappedByRebate.promoRebate, 20); // 1000 * 0.05 = 50 -> clamped to 20
  });

  it('normalizes foreign spend to HKD and deducts FX fee for net yield', () => {
    const feeCard = card({
      id: 'fx-fee',
      name: '1.95% FX Card',
      baseRebateRate: 0.04,
      fxFeeRate: 0.0195,
    });
    const freeCard = card({
      id: 'fx-free',
      name: '0% FX Card',
      baseRebateRate: 0.04,
      fxFeeRate: 0,
    });

    // 100 USD → 780 HKD mid-market; gross = 780 * 4% = 31.2
    const withFee = calculateTransactionRebate(
      feeCard,
      100,
      'shopping',
      '2026-03-15',
      [],
      'USD',
      BASELINE_FX_TABLE,
    );
    assert.equal(withFee.grossRebateAmount, 31.2);
    assert.equal(withFee.rebateAmount, 31.2);
    assert.equal(withFee.fxFeeAmount, 15.21); // 780 * 0.0195
    assert.equal(withFee.netRebateAmount, 15.99);
    assert.ok(Math.abs(withFee.netEffectiveRate - 15.99 / 780) < 1e-9);

    const feeFree = calculateTransactionRebate(
      freeCard,
      100,
      'shopping',
      '2026-03-15',
      [],
      'USD',
      BASELINE_FX_TABLE,
    );
    assert.equal(feeFree.fxFeeAmount, 0);
    assert.equal(feeFree.netRebateAmount, 31.2);
    assert.ok(feeFree.netRebateAmount > withFee.netRebateAmount);
  });

  it('auto-matches overseas rule for foreign spend when no category bonus applies', () => {
    const travel = card({
      id: 'travel-1',
      name: 'Travel',
      baseRebateRate: 0.004,
      fxFeeRate: 0,
      rebateRules: [
        {
          id: 'dining-5',
          category: 'dining',
          rebateRate: 0.05,
        },
        {
          id: 'overseas-2',
          category: 'overseas',
          rebateRate: 0.02,
        },
      ],
    });

    const foreignOther = calculateTransactionRebate(
      travel,
      100,
      'shopping',
      '2026-03-15',
      [],
      'USD',
      BASELINE_FX_TABLE,
    );
    assert.equal(foreignOther.matchedRuleId, 'overseas-2');
    // 780 HKD * 2% = 15.6
    assert.equal(foreignOther.rebateAmount, 15.6);

    const foreignDining = calculateTransactionRebate(
      travel,
      100,
      'dining',
      '2026-03-15',
      [],
      'USD',
      BASELINE_FX_TABLE,
    );
    assert.equal(foreignDining.matchedRuleId, 'dining-5');
    assert.equal(foreignDining.rebateAmount, 39); // 780 * 5%
  });

  it('stacks stackable promos and takes the best standalone promo', () => {
    const stacked = card({
      id: 'stack-1',
      name: 'Stack Card',
      baseRebateRate: 0.01,
      promotions: [
        {
          id: 'bank-wide',
          title: 'Bank +2%',
          category: 'all',
          extraRebateRate: 0.02,
          startDate: '2026-03-01',
          endDate: '2026-03-31',
          requiresRegistration: false,
          isRegistered: true,
          isStackable: true,
        },
        {
          id: 'weekend-dining',
          title: 'Weekend dining +3%',
          category: 'dining',
          extraRebateRate: 0.03,
          startDate: '2026-03-01',
          endDate: '2026-03-31',
          requiresRegistration: false,
          isRegistered: true,
          isStackable: true,
        },
        {
          id: 'standalone-a',
          title: 'Standalone +1%',
          category: 'all',
          extraRebateRate: 0.01,
          startDate: '2026-03-01',
          endDate: '2026-03-31',
          requiresRegistration: false,
          isRegistered: true,
        },
        {
          id: 'standalone-b',
          title: 'Standalone +4%',
          category: 'dining',
          extraRebateRate: 0.04,
          startDate: '2026-03-01',
          endDate: '2026-03-31',
          requiresRegistration: false,
          isRegistered: true,
        },
      ],
    });

    const result = calculateTransactionRebate(stacked, 1000, 'dining', '2026-03-15', []);
    // stackable: 20 + 30 = 50; best standalone: 40; total promo = 90
    assert.equal(result.promoRebate, 90);
    assert.deepEqual(result.matchedPromoIds, ['bank-wide', 'weekend-dining', 'standalone-b']);
    assert.equal(result.baseRebate, 10);
    assert.equal(result.rebateAmount, 100);
    assert.equal(result.grossRebateAmount, 100);
  });

  it('converts home spend into miles when milesConversionRate is set', () => {
    const milesCard = card({
      id: 'miles-1',
      name: 'Miles Card',
      rewardType: 'miles',
      baseRebateRate: 0.01,
      milesConversionRate: 4,
    });
    const result = calculateTransactionRebate(milesCard, 780, 'travel', '2026-03-15', []);
    assert.equal(result.rewardUnits, 195);
    assert.equal(result.rewardUnitLabel, 'miles');
  });
});

describe('getCardBillingCycleWindow', () => {
  it('uses calendar month by default and statement boundaries when configured', () => {
    const calendar = card({
      id: 'cal',
      name: 'Calendar',
      statementDayOfMonth: 15,
    });
    assert.deepEqual(getCardBillingCycleWindow(calendar, '2026-03-10'), {
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    });

    const statement = card({
      id: 'stmt',
      name: 'Statement',
      billingCycleType: 'statement',
      statementDayOfMonth: 15,
    });

    // On statement day (15th): cycle ends today, started prior month day 16
    assert.deepEqual(getCardBillingCycleWindow(statement, '2026-03-15'), {
      startDate: '2026-02-16',
      endDate: '2026-03-15',
    });

    // Day after statement (16th): new cycle starts today through next statement day
    assert.deepEqual(getCardBillingCycleWindow(statement, '2026-03-16'), {
      startDate: '2026-03-16',
      endDate: '2026-04-15',
    });
  });

  it('filters prior expenses by statement cycle window for cap tracking', () => {
    const statement = card({
      id: 'stmt-cap',
      name: 'Statement Cap',
      billingCycleType: 'statement',
      statementDayOfMonth: 15,
      baseRebateRate: 0.004,
      rebateRules: [
        {
          id: 'dining-5',
          category: 'dining',
          rebateRate: 0.05,
          monthlySpendCap: 1000,
        },
      ],
    });

    // Spend on March 16 starts a new cycle — Feb 20 prior spend must not count
    const afterCutover = calculateTransactionRebate(statement, 500, 'dining', '2026-03-16', [
      { amount: 900, category: 'dining', cardId: 'stmt-cap', dayKey: '2026-02-20' },
      { amount: 200, category: 'dining', cardId: 'stmt-cap', dayKey: '2026-03-20' },
    ]);
    assert.equal(afterCutover.isCapExceeded, false);
    assert.equal(afterCutover.bonusRebate, 23); // 500 * 4.6%

    // Spend on March 15 still in prior cycle — Feb 20 counts toward cap
    const onStatementDay = calculateTransactionRebate(statement, 500, 'dining', '2026-03-15', [
      { amount: 900, category: 'dining', cardId: 'stmt-cap', dayKey: '2026-02-20' },
    ]);
    assert.equal(onStatementDay.isCapExceeded, true);
    assert.equal(onStatementDay.bonusRebate, 4.6); // only 100 remaining at bonus
  });
});

describe('findBestCardForSpend', () => {
  it('ranks cards by rebate amount and returns runner-up', () => {
    const low = card({
      id: 'low',
      name: 'Low',
      baseRebateRate: 0.01,
      rebateRules: [{ id: 'all', category: 'all', rebateRate: 0.01 }],
    });
    const high = card({
      id: 'high',
      name: 'High Dining',
      baseRebateRate: 0.004,
      rebateRules: [{ id: 'dining', category: 'dining', rebateRate: 0.05 }],
    });
    const mid = card({
      id: 'mid',
      name: 'Mid',
      baseRebateRate: 0.02,
      rebateRules: [{ id: 'all', category: 'all', rebateRate: 0.02 }],
    });

    const ranked = findBestCardForSpend([low, high, mid], 1000, 'dining', '2026-03-15', []);
    assert.ok(ranked, 'expected a ranked card');
    assert.equal(ranked!.bestCard.id, 'high');
    assert.equal(ranked!.result.rebateAmount, 50);
    assert.equal(ranked!.runnerUp?.card.id, 'mid');
    assert.equal(ranked!.runnerUp?.result.rebateAmount, 20);
  });

  it('ranks foreign spend by net rebate so 0% FX fee cards win', () => {
    const feeCard = card({
      id: 'fee',
      name: 'High Gross Fee',
      baseRebateRate: 0.05,
      fxFeeRate: 0.0195,
    });
    const freeCard = card({
      id: 'free',
      name: 'Lower Gross Free FX',
      baseRebateRate: 0.04,
      fxFeeRate: 0,
    });

    const ranked = findBestCardForSpend(
      [feeCard, freeCard],
      100,
      'shopping',
      '2026-03-15',
      [],
      'USD',
      BASELINE_FX_TABLE,
    );
    assert.ok(ranked);
    assert.equal(ranked!.bestCard.id, 'free');
    assert.ok(ranked!.result.netRebateAmount > ranked!.runnerUp!.result.netRebateAmount);
  });

  it('hints when spend is within HK$500 of unlocking min monthly spend', () => {
    const gated = card({
      id: 'near-unlock',
      name: 'Near Unlock',
      baseRebateRate: 0.004,
      minMonthlySpendRequirement: 5000,
      rebateRules: [{ id: 'dining-5', category: 'dining', rebateRate: 0.05 }],
    });
    const result = calculateTransactionRebate(gated, 100, 'dining', '2026-03-15', [
      { amount: 4600, category: 'groceries', cardId: 'near-unlock', dayKey: '2026-03-01' },
    ]);
    assert.match(result.explanation, /400 from unlocking/);
  });

  it('returns null when there are no cards', () => {
    assert.equal(findBestCardForSpend([], 100, 'dining', '2026-03-15', []), null);
  });
});
describe('groupCardsByBank', () => {
  it('groups cards by builtin bank order and maps unknown banks to leftovers', () => {
    const cards = [
      card({ id: '1', name: 'HSBC Red', bankId: 'hsbc', bankName: 'HSBC' }),
      card({ id: '2', name: 'DBS Eminent', bankId: 'dbs', bankName: 'DBS' }),
      card({ id: '3', name: 'HSBC Signature', bankId: 'hsbc', bankName: 'HSBC' }),
      card({ id: '4', name: 'Mystery', bankId: 'custom-bank', bankName: 'Custom Bank' }),
    ];
    const groups = groupCardsByBank(cards);
    assert.equal(groups[0]?.bankId, 'hsbc');
    assert.equal(groups[0]?.cards.length, 2);
    assert.equal(groups[0]?.brandColor, '#DB0011');
    assert.equal(groups[1]?.bankId, 'dbs');
    assert.equal(groups[1]?.cards.length, 1);
    assert.equal(groups[2]?.bankId, 'custom-bank');
    assert.equal(groups[2]?.bankName, 'Custom Bank');
  });
});
