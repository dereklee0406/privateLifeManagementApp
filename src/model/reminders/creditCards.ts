import type { CreditCardPingRole, ReminderDraft } from './Reminder';
export type { CreditCardPingRole };
import { makeCategoryPath } from './categories';

/** Reward currency style for a card (cashback is the default UX). */
export type CardRewardType = 'cashback' | 'miles' | 'points';

/**
 * Purpose: category-specific bonus rebate rule on a credit card.
 * Inputs: card editor / preset templates.
 * Outputs: JSON field on CreditCardAccount.rebateRules.
 * Side effects: none.
 * Design decisions: rates are fractions (0.05 = 5%); caps are optional HKD amounts;
 *   pooled caps share a monthly envelope across sibling rules via pooledCapId.
 */
export interface CardRebateRule {
  id: string;
  /** e.g. dining, online, groceries, transport, shopping, entertainment, bills, overseas, all */
  category: string;
  /** Fraction of spend, e.g. 0.05 for 5%. */
  rebateRate: number;
  minSpendPerTx?: number;
  monthlySpendCap?: number;
  monthlyRebateCap?: number;
  isPooledCap?: boolean;
  pooledCapId?: string;
  description?: string;
}

/**
 * Purpose: time-limited bank promotion layered on top of base/bonus rates.
 * Inputs: promo manager / presets.
 * Outputs: JSON field on CreditCardAccount.promotions.
 * Side effects: none.
 * Design decisions: dates are civil YYYY-MM-DD; registration is tracked on-device only.
 */
export interface CardBankPromotion {
  id: string;
  title: string;
  category?: string;
  /** Extra fraction on top of base/bonus, e.g. 0.03 for +3%. */
  extraRebateRate: number;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
  /** Lower limit: minimum spend per single transaction to qualify. */
  minSpendPerTx?: number;
  /** Lower limit: minimum accumulated total spend during promo window to unlock. */
  minTotalSpend?: number;
  /** Upper limit: maximum eligible spend subject to the extra rebate. */
  maxSpendCap?: number;
  /** Upper limit: maximum rebate cash/miles dollar amount payable. */
  maxRebateCap?: number;
  /**
   * When true, this promo stacks additively with other stackable promos.
   * Standalone promos (false/undefined) compete for the single highest benefit.
   */
  isStackable?: boolean;
  requiresRegistration: boolean;
  isRegistered: boolean;
  termsNote?: string;
}

/**
 * Purpose: parent record for a credit card so several pings share due/statement/amount.
 * Inputs: Credit Card form.
 * Outputs: JSON row stored beside reminders (never PIN).
 * Side effects: none.
 * Design decisions: child Reminder rows hold schedule; this account holds structured money fields
 *   plus optional bank/rebate/promotion intelligence used by the domain rebate engine.
 */
export interface CreditCardAccount {
  id: string;
  name: string;
  dueDayOfMonth: number;
  statementDayOfMonth: number;
  /**
   * Cap / spend window for rebate math.
   * - `calendar` (default): 1st through last day of the civil month.
   * - `statement`: statementDay+1 of prior cycle through statementDay.
   */
  billingCycleType?: 'calendar' | 'statement';
  amountDue?: number;
  /** Optional outstanding balance treated as debt in net worth. */
  currentBalance?: number;
  /** Builtin bank id (hsbc, scb, …) or 'other'. */
  bankId?: string;
  /** Display name override (custom bank or localized label). */
  bankName?: string;
  /** e.g. Visa Signature, Red Mastercard. */
  cardTier?: string;
  rewardType?: CardRewardType;
  /** Default fraction when no category rule matches (e.g. 0.004 = 0.4%). */
  baseRebateRate?: number;
  /**
   * Foreign-transaction fee fraction (e.g. 0.0195 = 1.95%).
   * Undefined means the engine default of 1.95%; set 0 for fee-free travel cards.
   */
  fxFeeRate?: number;
  /**
   * Home-currency dollars per reward unit when rewardType is miles
   * (e.g. 4 → HK$4 = 1 mile).
   */
  milesConversionRate?: number;
  rebateRules?: CardRebateRule[];
  monthlySpendCap?: number;
  monthlyRebateCap?: number;
  annualSpendCap?: number;
  /** Spend this much in the month to unlock enhanced / bonus tier. */
  minMonthlySpendRequirement?: number;
  promotions?: CardBankPromotion[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Purpose: one OS notification owned by a card (statement day, due day, or extra).
 */
export interface CreditCardPingDraft {
  role: CreditCardPingRole;
  title: string;
  dayOfMonth: number;
  hour: number;
  minute: number;
  enabled: boolean;
}

/**
 * Purpose: default two pings — statement-day and due-day — for a new card.
 * Inputs: card name and civil days.
 * Outputs: ping drafts the writer can add to or edit.
 * Side effects: none.
 */
export function defaultCreditCardPings(input: {
  name: string;
  dueDayOfMonth: number;
  statementDayOfMonth: number;
}): CreditCardPingDraft[] {
  const name = input.name.trim() || 'Card';
  return [
    {
      role: 'statement',
      title: `${name} statement`,
      dayOfMonth: input.statementDayOfMonth,
      hour: 10,
      minute: 0,
      enabled: true,
    },
    {
      role: 'due',
      title: `${name} payment due`,
      dayOfMonth: input.dueDayOfMonth,
      hour: 10,
      minute: 0,
      enabled: true,
    },
  ];
}

/**
 * Purpose: map a ping onto a reminder draft (monthly on that day of month).
 * Inputs: account id, ping, optional amount for the due-note.
 * Outputs: ReminderDraft.
 * Side effects: none.
 */
export function draftFromCreditCardPing(
  accountId: string,
  ping: CreditCardPingDraft,
  amountDue?: number,
): ReminderDraft {
  const dueNote =
    ping.role === 'due' && amountDue !== undefined && Number.isFinite(amountDue)
      ? `Amount due ${amountDue}`
      : ping.role === 'statement'
        ? 'Statement is ready — review before the due date.'
        : '';
  return {
    kind: 'follow-up',
    title: ping.title,
    note: dueNote,
    hour: ping.hour,
    minute: ping.minute,
    enabled: ping.enabled,
    recurrence: { type: 'monthly', dayOfMonth: ping.dayOfMonth },
    priority: ping.role === 'due' ? 'high' : 'normal',
    categoryPath: makeCategoryPath('financial', 'credit-card'),
    templateId: 'credit-card',
    accountId,
    pingRole: ping.role,
  };
}

/**
 * Purpose: ping role label in the card editor.
 * Inputs: role.
 * Outputs: short English label.
 * Side effects: none.
 */
export function creditCardPingLabel(role: CreditCardPingRole): string {
  if (role === 'statement') {
    return 'Statement day';
  }
  if (role === 'due') {
    return 'Due day';
  }
  return 'Extra reminder';
}
