import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CreditCardAccount } from '../reminders/creditCards';
import {
  calculateTransactionRebate,
  findBestCardForSpend,
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
