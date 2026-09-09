import type {
  CardBankPromotion,
  CardRebateRule,
  CardRewardType,
  CreditCardAccount,
} from '../reminders/creditCards';
import { toDayKey } from '../../utils/dateUtils';

/** Recognized issuing-bank catalog id. */
export type BuiltinBankId =
  | 'hsbc'
  | 'scb'
  | 'hangseng'
  | 'boc'
  | 'citi'
  | 'dbs'
  | 'mox'
  | 'bea'
  | 'ccb'
  | 'amex'
  | 'chase'
  | 'other';

/**
 * Purpose: catalog entry for a recognized issuing bank (brand + icon for grouping UI).
 * Inputs: static catalog.
 * Outputs: bank metadata used by groupCardsByBank and presets.
 * Side effects: none.
 * Design decisions: icon is an Ionicons outline name (plain string) so Model stays UI-free;
 *   brandColor is a hex string the View can apply without another lookup table.
 */
export interface BuiltinBank {
  id: BuiltinBankId;
  name: string;
  brandColor: string;
  icon: string;
}

/**
 * Purpose: 1-tap card template that seeds bank, rates, rules, and caps.
 * Inputs: preset picker.
 * Outputs: field bag for CreditCardCreateInput / editor form.
 * Side effects: none.
 */
export interface PopularCardPreset {
  id: string;
  name: string;
  bankId: BuiltinBankId;
  bankName: string;
  cardTier?: string;
  rewardType: CardRewardType;
  baseRebateRate: number;
  rebateRules: CardRebateRule[];
  monthlySpendCap?: number;
  monthlyRebateCap?: number;
  annualSpendCap?: number;
  minMonthlySpendRequirement?: number;
  promotions?: CardBankPromotion[];
}

/**
 * Purpose: structured result of evaluating one spend against one card's rules.
 * Inputs: calculateTransactionRebate.
 * Outputs: amounts + rates + cap flags for live preview / ranking.
 * Side effects: none.
 */
export interface RebateCalculationResult {
  rebateAmount: number;
  effectiveRate: number;
  baseRebate: number;
  bonusRebate: number;
  promoRebate: number;
  isCapExceeded: boolean;
  capRemaining?: number;
  explanation: string;
  matchedRuleId?: string;
  matchedPromoId?: string;
}

/**
 * Purpose: month-to-date rebate health for one card.
 * Inputs: calculateCardMonthlyRebateSummary.
 * Outputs: totals, category breakdown, cap usage, active promos.
 * Side effects: none.
 */
export interface CardMonthlyRebateSummary {
  cardId: string;
  totalSpend: number;
  totalRebate: number;
  baseRebate: number;
  bonusRebate: number;
  promoRebate: number;
  spendCapUsed?: number;
  spendCapLimit?: number;
  rebateCapUsed?: number;
  rebateCapLimit?: number;
  capRemaining?: number;
  categoryBreakdown: Array<{ category: string; spend: number; rebate: number }>;
  activePromotions: CardBankPromotion[];
  meetsMinMonthlySpend: boolean;
}

export interface BankCardGroup {
  bankId: string;
  bankName: string;
  brandColor: string;
  icon: string;
  cards: CreditCardAccount[];
}

/** Lightweight expense row used by the rebate engine (no Finance model coupling). */
export interface RebateExpenseLike {
  amount: number;
  category: string;
  cardId?: string;
  dayKey?: string;
}

/**
 * Purpose: recognized banks with brand color and icon for grouping.
 * Inputs: none (static).
 * Outputs: catalog keyed by BuiltinBankId.
 * Side effects: none.
 */
export const BUILTIN_BANKS: ReadonlyArray<BuiltinBank> = [
  { id: 'hsbc', name: 'HSBC', brandColor: '#DB0011', icon: 'business-outline' },
  { id: 'scb', name: 'Standard Chartered', brandColor: '#0072AA', icon: 'business-outline' },
  { id: 'hangseng', name: 'Hang Seng', brandColor: '#009A44', icon: 'business-outline' },
  { id: 'boc', name: 'Bank of China', brandColor: '#A71E32', icon: 'business-outline' },
  { id: 'citi', name: 'Citibank', brandColor: '#003B70', icon: 'business-outline' },
  { id: 'dbs', name: 'DBS', brandColor: '#E35205', icon: 'business-outline' },
  { id: 'mox', name: 'Mox', brandColor: '#6C2BD9', icon: 'phone-portrait-outline' },
  { id: 'bea', name: 'Bank of East Asia', brandColor: '#E31837', icon: 'business-outline' },
  { id: 'ccb', name: 'China Construction Bank', brandColor: '#0066B3', icon: 'business-outline' },
  { id: 'amex', name: 'American Express', brandColor: '#006FCF', icon: 'card-outline' },
  { id: 'chase', name: 'Chase', brandColor: '#117ACA', icon: 'card-outline' },
  { id: 'other', name: 'Other', brandColor: '#6B7280', icon: 'ellipsis-horizontal-outline' },
];

const BANK_BY_ID: ReadonlyMap<string, BuiltinBank> = new Map(
  BUILTIN_BANKS.map((bank) => [bank.id, bank]),
);

/**
 * Purpose: popular HK / US card templates for 1-tap setup (simplified public structures).
 * Inputs: none (static).
 * Outputs: presets for the card editor.
 * Side effects: none.
 * Design decisions: rates/caps approximate published offers for UX seeding — not legal advice;
 *   rule ids are stable so presets can be re-applied idempotently in Phase 2 UI.
 */
export const POPULAR_CARD_PRESETS: ReadonlyArray<PopularCardPreset> = [
  {
    id: 'hsbc-red',
    name: 'HSBC Red',
    bankId: 'hsbc',
    bankName: 'HSBC',
    cardTier: 'Red Mastercard',
    rewardType: 'cashback',
    baseRebateRate: 0.004,
    rebateRules: [
      {
        id: 'hsbc-red-online',
        category: 'online',
        rebateRate: 0.04,
        monthlySpendCap: 10000,
        monthlyRebateCap: 400,
        description: '4% online (selected merchants)',
      },
      {
        id: 'hsbc-red-dining',
        category: 'dining',
        rebateRate: 0.02,
        monthlySpendCap: 5000,
        description: '2% dining',
      },
    ],
    monthlyRebateCap: 500,
  },
  {
    id: 'hsbc-visa-signature',
    name: 'HSBC Visa Signature',
    bankId: 'hsbc',
    bankName: 'HSBC',
    cardTier: 'Visa Signature',
    rewardType: 'cashback',
    baseRebateRate: 0.008,
    rebateRules: [
      {
        id: 'hsbc-vs-overseas',
        category: 'overseas',
        rebateRate: 0.025,
        monthlySpendCap: 20000,
        description: '2.5% overseas',
      },
      {
        id: 'hsbc-vs-dining',
        category: 'dining',
        rebateRate: 0.015,
        description: '1.5% dining',
      },
    ],
    monthlyRebateCap: 800,
    minMonthlySpendRequirement: 4000,
  },
  {
    id: 'scb-simply-cash',
    name: 'SCB Simply Cash',
    bankId: 'scb',
    bankName: 'Standard Chartered',
    cardTier: 'Simply Cash',
    rewardType: 'cashback',
    baseRebateRate: 0.015,
    rebateRules: [
      {
        id: 'scb-sc-all',
        category: 'all',
        rebateRate: 0.015,
        description: '1.5% unlimited cashback',
      },
    ],
  },
  {
    id: 'hangseng-mmpower',
    name: 'Hang Seng MMPOWER',
    bankId: 'hangseng',
    bankName: 'Hang Seng',
    cardTier: 'MMPOWER',
    rewardType: 'cashback',
    baseRebateRate: 0.005,
    rebateRules: [
      {
        id: 'hs-mm-dining',
        category: 'dining',
        rebateRate: 0.05,
        isPooledCap: true,
        pooledCapId: 'mmpower-bonus',
        monthlySpendCap: 10000,
        monthlyRebateCap: 500,
        description: '5% dining (pooled bonus)',
      },
      {
        id: 'hs-mm-online',
        category: 'online',
        rebateRate: 0.05,
        isPooledCap: true,
        pooledCapId: 'mmpower-bonus',
        monthlySpendCap: 10000,
        monthlyRebateCap: 500,
        description: '5% online (pooled bonus)',
      },
      {
        id: 'hs-mm-groceries',
        category: 'groceries',
        rebateRate: 0.03,
        isPooledCap: true,
        pooledCapId: 'mmpower-bonus',
        monthlySpendCap: 10000,
        monthlyRebateCap: 500,
        description: '3% groceries (pooled bonus)',
      },
    ],
    monthlyRebateCap: 500,
    minMonthlySpendRequirement: 5000,
  },
  {
    id: 'hangseng-travel-plus',
    name: 'Hang Seng Travel+',
    bankId: 'hangseng',
    bankName: 'Hang Seng',
    cardTier: 'Travel+',
    rewardType: 'miles',
    baseRebateRate: 0.01,
    rebateRules: [
      {
        id: 'hs-tp-overseas',
        category: 'overseas',
        rebateRate: 0.03,
        description: '3% overseas / travel',
      },
      {
        id: 'hs-tp-transport',
        category: 'transport',
        rebateRate: 0.02,
        description: '2% transport',
      },
    ],
    minMonthlySpendRequirement: 3000,
  },
  {
    id: 'dbs-eminent',
    name: 'DBS Eminent',
    bankId: 'dbs',
    bankName: 'DBS',
    cardTier: 'Eminent',
    rewardType: 'cashback',
    baseRebateRate: 0.01,
    rebateRules: [
      {
        id: 'dbs-em-dining',
        category: 'dining',
        rebateRate: 0.05,
        minSpendPerTx: 300,
        monthlySpendCap: 8000,
        monthlyRebateCap: 400,
        description: '5% dining (min HK$300/tx)',
      },
      {
        id: 'dbs-em-online',
        category: 'online',
        rebateRate: 0.04,
        minSpendPerTx: 300,
        monthlySpendCap: 8000,
        description: '4% online (min HK$300/tx)',
      },
    ],
    monthlyRebateCap: 500,
    minMonthlySpendRequirement: 4000,
  },
  {
    id: 'citi-cash-back',
    name: 'Citi Cash Back',
    bankId: 'citi',
    bankName: 'Citibank',
    cardTier: 'Cash Back',
    rewardType: 'cashback',
    baseRebateRate: 0.01,
    rebateRules: [
      {
        id: 'citi-cb-shopping',
        category: 'shopping',
        rebateRate: 0.05,
        monthlySpendCap: 6000,
        monthlyRebateCap: 300,
        description: '5% shopping',
      },
      {
        id: 'citi-cb-dining',
        category: 'dining',
        rebateRate: 0.03,
        monthlySpendCap: 4000,
        description: '3% dining',
      },
    ],
    monthlyRebateCap: 400,
  },
  {
    id: 'boc-chill',
    name: 'BOC Chill',
    bankId: 'boc',
    bankName: 'Bank of China',
    cardTier: 'Chill',
    rewardType: 'cashback',
    baseRebateRate: 0.008,
    rebateRules: [
      {
        id: 'boc-chill-online',
        category: 'online',
        rebateRate: 0.04,
        monthlySpendCap: 8000,
        description: '4% online',
      },
      {
        id: 'boc-chill-entertainment',
        category: 'entertainment',
        rebateRate: 0.03,
        monthlySpendCap: 4000,
        description: '3% entertainment',
      },
    ],
    monthlyRebateCap: 350,
  },
  {
    id: 'mox-credit',
    name: 'Mox Credit',
    bankId: 'mox',
    bankName: 'Mox',
    cardTier: 'Credit',
    rewardType: 'cashback',
    baseRebateRate: 0.01,
    rebateRules: [
      {
        id: 'mox-all',
        category: 'all',
        rebateRate: 0.01,
        description: '1% everywhere',
      },
      {
        id: 'mox-online',
        category: 'online',
        rebateRate: 0.03,
        monthlySpendCap: 5000,
        description: '3% selected online',
      },
    ],
    monthlyRebateCap: 300,
  },
  {
    id: 'chase-sapphire-preferred',
    name: 'Chase Sapphire Preferred',
    bankId: 'chase',
    bankName: 'Chase',
    cardTier: 'Sapphire Preferred',
    rewardType: 'points',
    baseRebateRate: 0.01,
    rebateRules: [
      {
        id: 'chase-sp-dining',
        category: 'dining',
        rebateRate: 0.03,
        description: '3x dining',
      },
      {
        id: 'chase-sp-online',
        category: 'online',
        rebateRate: 0.02,
        description: '2x online travel / select',
      },
      {
        id: 'chase-sp-overseas',
        category: 'overseas',
        rebateRate: 0.02,
        description: '2x travel',
      },
    ],
  },
];

/**
 * Purpose: look up builtin bank metadata with safe 'other' fallback.
 * Inputs: bankId string.
 * Outputs: BuiltinBank.
 * Side effects: none.
 */
export function resolveBuiltinBank(bankId?: string): BuiltinBank {
  if (bankId && BANK_BY_ID.has(bankId)) {
    return BANK_BY_ID.get(bankId)!;
  }
  return BANK_BY_ID.get('other')!;
}

/**
 * Purpose: civil YYYY-MM-DD from Date or string input.
 * Inputs: Date or day-key / ISO string.
 * Outputs: YYYY-MM-DD.
 * Side effects: none.
 */
function toCivilDayKey(date: Date | string): string {
  if (typeof date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    const parsed = new Date(date);
    if (!Number.isNaN(parsed.getTime())) {
      return toDayKey(parsed);
    }
    return toDayKey(new Date());
  }
  return toDayKey(date);
}

/**
 * Purpose: YYYY-MM month key from a civil day key.
 * Inputs: YYYY-MM-DD.
 * Outputs: YYYY-MM.
 * Side effects: none.
 */
function monthKeyFromDay(dayKey: string): string {
  return dayKey.slice(0, 7);
}

/**
 * Purpose: filter expenses belonging to a card in the same calendar month as dayKey.
 * Inputs: card id, month day key, expense rows.
 * Outputs: matching expense rows with finite positive amounts.
 * Side effects: none.
 */
function expensesForCardMonth(
  cardId: string,
  dayKey: string,
  monthlyExpenses: RebateExpenseLike[],
): RebateExpenseLike[] {
  const monthKey = monthKeyFromDay(dayKey);
  return monthlyExpenses.filter((expense) => {
    if (expense.cardId !== cardId) {
      return false;
    }
    if (!Number.isFinite(expense.amount) || expense.amount <= 0) {
      return false;
    }
    if (expense.dayKey && monthKeyFromDay(expense.dayKey) !== monthKey) {
      return false;
    }
    return true;
  });
}

/**
 * Purpose: pick the best matching rebate rule for a category.
 * Inputs: rules + spend category.
 * Outputs: exact category match, else 'all', else undefined.
 * Side effects: none.
 */
function findMatchingRule(
  rules: CardRebateRule[] | undefined,
  category: string,
): CardRebateRule | undefined {
  if (!rules?.length) {
    return undefined;
  }
  const normalized = category.trim().toLowerCase() || 'other';
  const exact = rules.find((rule) => rule.category.trim().toLowerCase() === normalized);
  if (exact) {
    return exact;
  }
  return rules.find((rule) => rule.category.trim().toLowerCase() === 'all');
}

/**
 * Purpose: whether a promotion is live on dayKey and eligible for category/registration.
 * Inputs: promo + civil day + category.
 * Outputs: true when date/category/registration gates pass (spend gates checked separately).
 * Side effects: none.
 */
function isPromotionActiveOnDay(
  promo: CardBankPromotion,
  dayKey: string,
  category: string,
): boolean {
  if (dayKey < promo.startDate || dayKey > promo.endDate) {
    return false;
  }
  if (promo.requiresRegistration && !promo.isRegistered) {
    return false;
  }
  if (!promo.category || promo.category.trim().toLowerCase() === 'all') {
    return true;
  }
  return promo.category.trim().toLowerCase() === (category.trim().toLowerCase() || 'other');
}

/**
 * Purpose: sum spend for a card month, optionally restricted to categories.
 * Inputs: expenses + optional category set.
 * Outputs: total amount.
 * Side effects: none.
 */
function sumSpend(expenses: RebateExpenseLike[], categories?: Set<string>): number {
  return expenses.reduce((total, expense) => {
    if (categories && !categories.has(expense.category.trim().toLowerCase() || 'other')) {
      return total;
    }
    return total + expense.amount;
  }, 0);
}

/**
 * Purpose: estimate rebate already earned this month for promo-cap tracking.
 * Inputs: card, prior expenses, promo.
 * Outputs: approximate promo rebate dollars already counted.
 * Side effects: none.
 * Design decisions: uses promo.extraRebateRate × eligible prior spend, capped — good enough
 *   for remaining-cap UX without replaying full history.
 */
function estimatedPromoRebateUsed(
  promo: CardBankPromotion,
  prior: RebateExpenseLike[],
): number {
  const eligible = prior.filter((expense) => {
    if (promo.minSpendPerTx && expense.amount < promo.minSpendPerTx) {
      return false;
    }
    if (!promo.category || promo.category.trim().toLowerCase() === 'all') {
      return true;
    }
    return expense.category.trim().toLowerCase() === promo.category.trim().toLowerCase();
  });
  const spend = sumSpend(eligible);
  const raw = spend * promo.extraRebateRate;
  if (promo.maxRebateCap !== undefined) {
    return Math.min(raw, promo.maxRebateCap);
  }
  return raw;
}

/**
 * Purpose: compute rebate dollars for one prospective spend on one card.
 * Inputs: card, amount, category, date, month-to-date expenses (may include other cards).
 * Outputs: RebateCalculationResult with base/bonus/promo split and cap flags.
 * Side effects: none.
 * Design decisions: when a category spend/rebate cap is partially consumed, the current
 *   amount is split into bonus-eligible vs base-only portions; card-level monthlyRebateCap
 *   clamps the total after promo stacking.
 */
export function calculateTransactionRebate(
  card: CreditCardAccount,
  amount: number,
  category: string,
  date: Date | string,
  monthlyExpenses: RebateExpenseLike[],
): RebateCalculationResult {
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const dayKey = toCivilDayKey(date);
  const baseRate =
    typeof card.baseRebateRate === 'number' &&
    Number.isFinite(card.baseRebateRate) &&
    card.baseRebateRate >= 0
      ? card.baseRebateRate
      : 0.004;
  const prior = expensesForCardMonth(card.id, dayKey, monthlyExpenses);
  const priorSpend = sumSpend(prior);
  const cumulativeSpend = priorSpend + safeAmount;
  const meetsMinMonthly =
    card.minMonthlySpendRequirement === undefined ||
    cumulativeSpend >= card.minMonthlySpendRequirement;

  const empty = (explanation: string): RebateCalculationResult => ({
    rebateAmount: 0,
    effectiveRate: 0,
    baseRebate: 0,
    bonusRebate: 0,
    promoRebate: 0,
    isCapExceeded: false,
    explanation,
  });

  if (safeAmount <= 0) {
    return empty('No spend amount.');
  }

  let matchedRule = findMatchingRule(card.rebateRules, category);
  if (matchedRule?.minSpendPerTx && safeAmount < matchedRule.minSpendPerTx) {
    matchedRule = undefined;
  }
  if (!meetsMinMonthly) {
    matchedRule = undefined;
  }

  const bonusRate = matchedRule && matchedRule.rebateRate > baseRate ? matchedRule.rebateRate : 0;
  const useBonus = bonusRate > 0;

  let bonusEligibleAmount = useBonus ? safeAmount : 0;
  let isCapExceeded = false;
  let capRemaining: number | undefined;

  if (useBonus && matchedRule) {
    const poolId = matchedRule.isPooledCap ? matchedRule.pooledCapId : undefined;
    const pooledRules =
      poolId && card.rebateRules
        ? card.rebateRules.filter((rule) => rule.isPooledCap && rule.pooledCapId === poolId)
        : matchedRule
          ? [matchedRule]
          : [];
    const poolCategories = new Set(
      pooledRules.map((rule) => rule.category.trim().toLowerCase() || 'other'),
    );
    const priorCategorySpend = sumSpend(prior, poolCategories.size ? poolCategories : undefined);

    const spendCap = matchedRule.monthlySpendCap ?? card.monthlySpendCap;
    if (spendCap !== undefined) {
      const remainingSpend = Math.max(0, spendCap - priorCategorySpend);
      capRemaining = remainingSpend;
      if (remainingSpend <= 0) {
        bonusEligibleAmount = 0;
        isCapExceeded = true;
      } else if (safeAmount > remainingSpend) {
        bonusEligibleAmount = remainingSpend;
        isCapExceeded = true;
        capRemaining = 0;
      } else {
        capRemaining = remainingSpend - safeAmount;
      }
    }

    const rebateCap = matchedRule.monthlyRebateCap ?? card.monthlyRebateCap;
    if (rebateCap !== undefined && bonusEligibleAmount > 0) {
      const priorBonusRebate = prior.reduce((total, expense) => {
        const cat = expense.category.trim().toLowerCase() || 'other';
        if (poolCategories.size && !poolCategories.has(cat)) {
          return total;
        }
        const rule = findMatchingRule(card.rebateRules, expense.category);
        if (!rule || rule.rebateRate <= baseRate) {
          return total;
        }
        if (rule.minSpendPerTx && expense.amount < rule.minSpendPerTx) {
          return total;
        }
        return total + expense.amount * (rule.rebateRate - baseRate);
      }, 0);
      const remainingRebate = Math.max(0, rebateCap - priorBonusRebate);
      const maxBonusSpend = bonusRate > 0 ? remainingRebate / (bonusRate - baseRate || bonusRate) : 0;
      if (remainingRebate <= 0) {
        bonusEligibleAmount = 0;
        isCapExceeded = true;
        capRemaining = 0;
      } else if (bonusEligibleAmount * (bonusRate - baseRate) > remainingRebate) {
        bonusEligibleAmount = Math.min(bonusEligibleAmount, maxBonusSpend);
        isCapExceeded = true;
        capRemaining = 0;
      }
    }
  }

  const baseRebate = roundMoney(safeAmount * baseRate);
  const bonusRebate = useBonus
    ? roundMoney(bonusEligibleAmount * (bonusRate - baseRate))
    : 0;

  let promoRebate = 0;
  let matchedPromoId: string | undefined;
  const promotions = card.promotions ?? [];
  for (const promo of promotions) {
    if (!isPromotionActiveOnDay(promo, dayKey, category)) {
      continue;
    }
    if (promo.minSpendPerTx && safeAmount < promo.minSpendPerTx) {
      continue;
    }
    if (promo.minTotalSpend && cumulativeSpend < promo.minTotalSpend) {
      continue;
    }
    const used = estimatedPromoRebateUsed(promo, prior);
    const remaining =
      promo.maxRebateCap !== undefined ? Math.max(0, promo.maxRebateCap - used) : Number.POSITIVE_INFINITY;
    if (remaining <= 0) {
      continue;
    }
    const raw = safeAmount * promo.extraRebateRate;
    const applied = roundMoney(Math.min(raw, remaining));
    if (applied > promoRebate) {
      promoRebate = applied;
      matchedPromoId = promo.id;
    }
  }

  let rebateAmount = roundMoney(baseRebate + bonusRebate + promoRebate);
  if (card.monthlyRebateCap !== undefined) {
    const priorTotalRebate = prior.reduce((total, expense) => {
      const result = calculateTransactionRebate(
        { ...card, monthlyRebateCap: undefined, promotions: [] },
        expense.amount,
        expense.category,
        expense.dayKey ?? dayKey,
        [],
      );
      return total + result.rebateAmount;
    }, 0);
    const room = Math.max(0, card.monthlyRebateCap - priorTotalRebate);
    if (rebateAmount > room) {
      rebateAmount = roundMoney(room);
      isCapExceeded = true;
      capRemaining = 0;
    } else if (capRemaining === undefined) {
      capRemaining = roundMoney(room - rebateAmount);
    }
  }

  const effectiveRate = safeAmount > 0 ? rebateAmount / safeAmount : 0;
  const parts: string[] = [];
  if (bonusRebate > 0 && matchedRule) {
    parts.push(
      `${formatPercent(bonusRate)} ${matchedRule.category}${isCapExceeded ? ' (partial cap)' : ''}`,
    );
  } else {
    parts.push(`${formatPercent(baseRate)} base`);
  }
  if (promoRebate > 0) {
    parts.push(`+${formatPercent(promoRebate / safeAmount)} promo`);
  }
  if (isCapExceeded && bonusRebate <= 0) {
    parts.push('cap reached');
  }
  if (!meetsMinMonthly && card.minMonthlySpendRequirement) {
    parts.push(`need HK$${card.minMonthlySpendRequirement} monthly spend`);
  }

  return {
    rebateAmount,
    effectiveRate,
    baseRebate,
    bonusRebate,
    promoRebate,
    isCapExceeded,
    capRemaining,
    explanation: parts.join(' · '),
    matchedRuleId: matchedRule?.id,
    matchedPromoId,
  };
}

/**
 * Purpose: aggregate month-to-date rebate health for one card.
 * Inputs: card + expenses already scoped or filterable by cardId.
 * Outputs: CardMonthlyRebateSummary.
 * Side effects: none.
 */
export function calculateCardMonthlyRebateSummary(
  card: CreditCardAccount,
  monthlyExpenses: Array<{ amount: number; category: string; cardId?: string }>,
): CardMonthlyRebateSummary {
  const todayKey = toDayKey(new Date());
  const rows = expensesForCardMonth(
    card.id,
    todayKey,
    monthlyExpenses.map((expense) => ({ ...expense, dayKey: todayKey })),
  );
  const categoryMap = new Map<string, { spend: number; rebate: number }>();
  let totalSpend = 0;
  let totalRebate = 0;
  let baseRebate = 0;
  let bonusRebate = 0;
  let promoRebate = 0;

  const running: RebateExpenseLike[] = [];
  for (const expense of rows) {
    const result = calculateTransactionRebate(
      card,
      expense.amount,
      expense.category,
      todayKey,
      running,
    );
    totalSpend += expense.amount;
    totalRebate += result.rebateAmount;
    baseRebate += result.baseRebate;
    bonusRebate += result.bonusRebate;
    promoRebate += result.promoRebate;
    const key = expense.category.trim().toLowerCase() || 'other';
    const bucket = categoryMap.get(key) ?? { spend: 0, rebate: 0 };
    bucket.spend += expense.amount;
    bucket.rebate += result.rebateAmount;
    categoryMap.set(key, bucket);
    running.push({ ...expense, cardId: card.id, dayKey: todayKey });
  }

  const spendCapLimit = card.monthlySpendCap;
  const rebateCapLimit = card.monthlyRebateCap;
  const spendCapUsed = spendCapLimit !== undefined ? Math.min(totalSpend, spendCapLimit) : undefined;
  const rebateCapUsed =
    rebateCapLimit !== undefined ? Math.min(totalRebate, rebateCapLimit) : undefined;
  let capRemaining: number | undefined;
  if (rebateCapLimit !== undefined) {
    capRemaining = Math.max(0, rebateCapLimit - totalRebate);
  } else if (spendCapLimit !== undefined) {
    capRemaining = Math.max(0, spendCapLimit - totalSpend);
  }

  const activePromotions = (card.promotions ?? []).filter((promo) =>
    isPromotionActiveOnDay(promo, todayKey, promo.category ?? 'all'),
  );

  return {
    cardId: card.id,
    totalSpend: roundMoney(totalSpend),
    totalRebate: roundMoney(totalRebate),
    baseRebate: roundMoney(baseRebate),
    bonusRebate: roundMoney(bonusRebate),
    promoRebate: roundMoney(promoRebate),
    spendCapUsed: spendCapUsed !== undefined ? roundMoney(spendCapUsed) : undefined,
    spendCapLimit,
    rebateCapUsed: rebateCapUsed !== undefined ? roundMoney(rebateCapUsed) : undefined,
    rebateCapLimit,
    capRemaining: capRemaining !== undefined ? roundMoney(capRemaining) : undefined,
    categoryBreakdown: [...categoryMap.entries()].map(([category, value]) => ({
      category,
      spend: roundMoney(value.spend),
      rebate: roundMoney(value.rebate),
    })),
    activePromotions,
    meetsMinMonthlySpend:
      card.minMonthlySpendRequirement === undefined ||
      totalSpend >= card.minMonthlySpendRequirement,
  };
}

/**
 * Purpose: rank cards by rebate for a prospective spend and return the winner.
 * Inputs: cards, amount, category, date, month expenses.
 * Outputs: best card + result, optional runner-up; null when no cards.
 * Side effects: none.
 */
export function findBestCardForSpend(
  cards: CreditCardAccount[],
  amount: number,
  category: string,
  date: Date | string,
  monthlyExpenses: RebateExpenseLike[],
): {
  bestCard: CreditCardAccount;
  result: RebateCalculationResult;
  runnerUp?: { card: CreditCardAccount; result: RebateCalculationResult };
} | null {
  if (!cards.length) {
    return null;
  }
  const ranked = cards
    .map((card) => ({
      card,
      result: calculateTransactionRebate(card, amount, category, date, monthlyExpenses),
    }))
    .sort((left, right) => {
      const rebateDelta = right.result.rebateAmount - left.result.rebateAmount;
      if (rebateDelta !== 0) {
        return rebateDelta;
      }
      return right.result.effectiveRate - left.result.effectiveRate;
    });
  const best = ranked[0];
  const second = ranked[1];
  return {
    bestCard: best.card,
    result: best.result,
    runnerUp: second ? { card: second.card, result: second.result } : undefined,
  };
}

/**
 * Purpose: group credit cards by issuing bank for Payment Cards UI.
 * Inputs: credit card accounts.
 * Outputs: bank groups with brand metadata; preserves relative card order within a bank.
 * Side effects: none.
 * Design decisions: unknown bankId maps to 'other'; groups follow BUILTIN_BANKS order,
 *   then any leftover custom bank ids alphabetically.
 */
export function groupCardsByBank(cards: CreditCardAccount[]): BankCardGroup[] {
  const buckets = new Map<string, CreditCardAccount[]>();
  for (const card of cards) {
    const bankId =
      typeof card.bankId === 'string' && card.bankId.trim() ? card.bankId.trim() : 'other';
    const list = buckets.get(bankId) ?? [];
    list.push(card);
    buckets.set(bankId, list);
  }

  const groups: BankCardGroup[] = [];
  for (const bank of BUILTIN_BANKS) {
    const list = buckets.get(bank.id);
    if (!list?.length) {
      continue;
    }
    buckets.delete(bank.id);
    groups.push({
      bankId: bank.id,
      bankName: list[0]?.bankName?.trim() || bank.name,
      brandColor: bank.brandColor,
      icon: bank.icon,
      cards: list,
    });
  }

  const leftovers = [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right));
  for (const [bankId, list] of leftovers) {
    groups.push({
      bankId,
      bankName: list[0]?.bankName?.trim() || bankId,
      brandColor: '#6B7280',
      icon: 'business-outline',
      cards: list,
    });
  }
  return groups;
}

/**
 * Purpose: round currency to 2 decimal places.
 * Inputs: number.
 * Outputs: finite money amount.
 * Side effects: none.
 */
function roundMoney(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 100) / 100;
}

/**
 * Purpose: human-readable percent for explanation strings.
 * Inputs: fraction (0.05 → 5%).
 * Outputs: compact percent label.
 * Side effects: none.
 */
function formatPercent(rate: number): string {
  const pct = rate * 100;
  const rounded = Math.round(pct * 100) / 100;
  return `${rounded}%`;
}
