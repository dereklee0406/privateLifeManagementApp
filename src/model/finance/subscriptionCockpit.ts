import { toDayKey } from '../../utils/dateUtils';
import type { MoneyCurrency } from '../settings/AppSettings';
import type { CreditCardAccount } from '../reminders/creditCards';
import {
  resolveRecurringSpendFrequency,
  WEEKDAY_REPEAT,
  type RecurringSpend,
} from './recurringSpend';

/**
 * Purpose: billing cadence used by the subscriptions cockpit (extends spend frequency with yearly).
 * Inputs: RecurringSpend.frequency or future yearly contracts.
 * Outputs: burn-rate and renewal math selectors.
 */
export type SubscriptionCadence = 'daily' | 'weekday' | 'weekly' | 'monthly' | 'yearly';

/**
 * Purpose: one recurring contract with burn rates and renewal countdown for list / strip UI.
 * Inputs: RecurringSpend plus computed equivalents and card label.
 * Outputs: view-ready summary row.
 */
export interface SubscriptionSummaryItem {
  item: RecurringSpend;
  monthlyEquivalent: number;
  annualEquivalent: number;
  nextRenewalDate: string;
  daysUntilRenewal: number;
  cardName?: string;
}

/**
 * Purpose: monthly burn rolled up by paying credit card.
 * Inputs: aggregations from computeSubscriptionsSummary.
 * Outputs: card allocation pills.
 */
export interface CardSubscriptionAllocation {
  cardId: string;
  cardName: string;
  monthlyTotal: number;
  count: number;
}

/**
 * Purpose: monthly burn rolled up by expense category.
 * Inputs: aggregations from computeSubscriptionsSummary.
 * Outputs: category breakdown rows.
 */
export interface CategorySubscriptionAllocation {
  category: string;
  monthlyTotal: number;
  count: number;
}

/**
 * Purpose: full subscriptions cockpit snapshot for the Money → Subscriptions screen.
 * Inputs: computeSubscriptionsSummary.
 * Outputs: hero totals, renewals strip, card and category maps.
 */
export interface SubscriptionsCockpitSummary {
  totalMonthlyBurn: number;
  totalAnnualBurn: number;
  activeCount: number;
  upcomingRenewals: SubscriptionSummaryItem[];
  byCard: CardSubscriptionAllocation[];
  byCategory: CategorySubscriptionAllocation[];
}

const CENT = 100;
const UPCOMING_RENEWAL_HORIZON_DAYS = 14;
const TOP_UPCOMING_FALLBACK = 5;

/**
 * Purpose: round to two-decimal money.
 * Inputs: raw number.
 * Outputs: cent-safe amount, or 0 when non-finite.
 * Side effects: none.
 */
function roundMoney(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * CENT) / CENT;
}

/**
 * Purpose: last civil day of a local month (monthIndex 0–11).
 * Inputs: year and month index.
 * Outputs: 28–31.
 * Side effects: none.
 */
function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Purpose: local midnight for whole-day diffs (avoids DST hour noise).
 * Inputs: Date.
 * Outputs: same civil day at 00:00:00 local.
 * Side effects: none.
 */
function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

/**
 * Purpose: resolve cockpit cadence from a recurring spend row.
 * Inputs: RecurringSpend (may omit frequency).
 * Outputs: SubscriptionCadence (legacy → weekday).
 * Side effects: none.
 * Design decisions: RecurringSpendFrequency has no yearly yet; cadence type reserves it.
 */
function resolveCadence(item: RecurringSpend): SubscriptionCadence {
  return resolveRecurringSpendFrequency(item);
}

/**
 * Purpose: monthly-equivalent burn for one recurring contract.
 * Inputs: RecurringSpend amount + frequency.
 * Outputs: monthly burn in the item’s currency (two decimals).
 * Side effects: none.
 * Design decisions: daily ≈ 365/12; weekday ≈ 260 working days / 12; weekly ≈ 52/12;
 *   monthly is the amount; yearly (reserved) is amount / 12.
 */
export function calculateMonthlyBurn(item: RecurringSpend): number {
  const amount = Math.max(0, item.amount);
  switch (resolveCadence(item)) {
    case 'daily':
      return roundMoney(amount * (365 / 12));
    case 'weekday':
      return roundMoney(amount * (260 / 12));
    case 'weekly':
      return roundMoney(amount * (52 / 12));
    case 'yearly':
      return roundMoney(amount / 12);
    case 'monthly':
    default:
      return roundMoney(amount);
  }
}

/**
 * Purpose: annualized burn for one recurring contract.
 * Inputs: RecurringSpend.
 * Outputs: monthly burn × 12, rounded.
 * Side effects: none.
 */
export function calculateAnnualBurn(item: RecurringSpend): number {
  return roundMoney(calculateMonthlyBurn(item) * 12);
}

/**
 * Purpose: resolve monthly day-of-month anchor (1–31) from rule fields.
 * Inputs: RecurringSpend.dayOfMonth.
 * Outputs: target day number, or 'end' sentinel for last civil day.
 * Side effects: none.
 */
function resolveMonthlyDayTarget(item: RecurringSpend, today: Date): number | 'end' {
  const anchor = item.dayOfMonth;
  if (anchor === 'start') {
    return 1;
  }
  if (anchor === 'end') {
    return 'end';
  }
  if (typeof anchor === 'number' && Number.isFinite(anchor)) {
    return Math.min(31, Math.max(1, Math.floor(anchor)));
  }
  return today.getDate();
}

/**
 * Purpose: next civil date this subscription renews / is due.
 * Inputs: RecurringSpend, optional today (defaults to now).
 * Outputs: local Date at midnight of the next renewal day.
 * Side effects: none.
 * Design decisions: monthly clamps 31 onto Feb 28/29; weekly uses dayOfWeek (or weekdays[0]);
 *   weekday lands on next Mon–Fri (today if weekday); daily is today (due every day / not-yet-logged).
 */
export function calculateNextRenewalDate(item: RecurringSpend, today: Date = new Date()): Date {
  const base = startOfLocalDay(today);
  const cadence = resolveCadence(item);

  switch (cadence) {
    case 'daily':
      return base;

    case 'weekday': {
      const days = item.weekdays.length ? item.weekdays : WEEKDAY_REPEAT;
      for (let offset = 0; offset < 8; offset += 1) {
        const candidate = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
        if (days.includes(candidate.getDay())) {
          return candidate;
        }
      }
      // Fallback: next Monday.
      const day = base.getDay();
      const toMonday = day === 0 ? 1 : day === 6 ? 2 : 0;
      return new Date(base.getFullYear(), base.getMonth(), base.getDate() + toMonday);
    }

    case 'weekly': {
      const target =
        typeof item.dayOfWeek === 'number' && item.dayOfWeek >= 0 && item.dayOfWeek <= 6
          ? item.dayOfWeek
          : item.weekdays[0] ?? base.getDay();
      const current = base.getDay();
      const delta = (target - current + 7) % 7;
      return new Date(base.getFullYear(), base.getMonth(), base.getDate() + delta);
    }

    case 'yearly': {
      // Reserved cadence: anniversary on today’s month/day next occurrence.
      const month = base.getMonth();
      const day = base.getDate();
      const thisYear = new Date(base.getFullYear(), month, day);
      if (thisYear.getTime() >= base.getTime()) {
        return thisYear;
      }
      return new Date(base.getFullYear() + 1, month, day);
    }

    case 'monthly':
    default: {
      const target = resolveMonthlyDayTarget(item, base);
      const tryMonth = (year: number, monthIndex: number): Date => {
        const last = lastDayOfMonth(year, monthIndex);
        const day = target === 'end' ? last : Math.min(target, last);
        return new Date(year, monthIndex, day);
      };
      const thisMonth = tryMonth(base.getFullYear(), base.getMonth());
      if (thisMonth.getTime() >= base.getTime()) {
        return thisMonth;
      }
      const nextMonthIndex = base.getMonth() + 1;
      const nextYear = base.getFullYear() + Math.floor(nextMonthIndex / 12);
      return tryMonth(nextYear, nextMonthIndex % 12);
    }
  }
}

/**
 * Purpose: whole days until the next renewal (0 = renews today).
 * Inputs: RecurringSpend, optional today.
 * Outputs: non-negative integer day count.
 * Side effects: none.
 */
export function daysUntilRenewal(item: RecurringSpend, today: Date = new Date()): number {
  const renewal = startOfLocalDay(calculateNextRenewalDate(item, today));
  const start = startOfLocalDay(today);
  const diffMs = renewal.getTime() - start.getTime();
  return Math.max(0, Math.round(diffMs / 86_400_000));
}

/**
 * Purpose: build one summary row for a recurring spend.
 * Inputs: item, cards list, today.
 * Outputs: SubscriptionSummaryItem.
 * Side effects: none.
 */
function toSummaryItem(
  item: RecurringSpend,
  cards: CreditCardAccount[],
  today: Date,
): SubscriptionSummaryItem {
  const renewal = calculateNextRenewalDate(item, today);
  const cardName = item.cardId ? cards.find((card) => card.id === item.cardId)?.name : undefined;
  return {
    item,
    monthlyEquivalent: calculateMonthlyBurn(item),
    annualEquivalent: calculateAnnualBurn(item),
    nextRenewalDate: toDayKey(renewal),
    daysUntilRenewal: daysUntilRenewal(item, today),
    cardName,
  };
}

/**
 * Purpose: aggregate burn, renewals, and card/category allocation for the cockpit.
 * Inputs: recurring spends, credit cards, home/display currency, optional today.
 * Outputs: SubscriptionsCockpitSummary.
 * Side effects: none.
 * Design decisions: only rows matching `currency` contribute (no live FX); upcoming renewals
 *   prefer the next 14 days, else the soonest few; byCard skips unmapped cardIds.
 */
export function computeSubscriptionsSummary(
  items: RecurringSpend[],
  cards: CreditCardAccount[],
  currency: MoneyCurrency,
  today: Date = new Date(),
): SubscriptionsCockpitSummary {
  const scoped = items.filter((item) => item.currency === currency);
  const rows = scoped.map((item) => toSummaryItem(item, cards, today));

  const totalMonthlyBurn = roundMoney(rows.reduce((sum, row) => sum + row.monthlyEquivalent, 0));
  const totalAnnualBurn = roundMoney(rows.reduce((sum, row) => sum + row.annualEquivalent, 0));

  const withinHorizon = rows
    .filter((row) => row.daysUntilRenewal <= UPCOMING_RENEWAL_HORIZON_DAYS)
    .sort((left, right) => left.daysUntilRenewal - right.daysUntilRenewal);

  const upcomingRenewals =
    withinHorizon.length > 0
      ? withinHorizon
      : [...rows]
          .sort((left, right) => left.daysUntilRenewal - right.daysUntilRenewal)
          .slice(0, TOP_UPCOMING_FALLBACK);

  const cardMap = new Map<string, CardSubscriptionAllocation>();
  for (const row of rows) {
    const cardId = row.item.cardId;
    if (!cardId) {
      continue;
    }
    const cardName = row.cardName ?? cards.find((card) => card.id === cardId)?.name ?? cardId;
    const existing = cardMap.get(cardId);
    if (existing) {
      existing.monthlyTotal = roundMoney(existing.monthlyTotal + row.monthlyEquivalent);
      existing.count += 1;
    } else {
      cardMap.set(cardId, {
        cardId,
        cardName,
        monthlyTotal: row.monthlyEquivalent,
        count: 1,
      });
    }
  }

  const categoryMap = new Map<string, CategorySubscriptionAllocation>();
  for (const row of rows) {
    const category = row.item.category;
    const existing = categoryMap.get(category);
    if (existing) {
      existing.monthlyTotal = roundMoney(existing.monthlyTotal + row.monthlyEquivalent);
      existing.count += 1;
    } else {
      categoryMap.set(category, {
        category,
        monthlyTotal: row.monthlyEquivalent,
        count: 1,
      });
    }
  }

  return {
    totalMonthlyBurn,
    totalAnnualBurn,
    activeCount: rows.length,
    upcomingRenewals,
    byCard: [...cardMap.values()].sort((left, right) => right.monthlyTotal - left.monthlyTotal),
    byCategory: [...categoryMap.values()].sort((left, right) => right.monthlyTotal - left.monthlyTotal),
  };
}
