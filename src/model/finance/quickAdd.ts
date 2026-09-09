import type { Expense, ExpenseCategory, ExpenseDraft } from './Expense';
import {
  EXPENSE_CATEGORIES,
  expenseCategoryFallbackLabel,
  quickAddCategoryIds,
  DEFAULT_QUICK_ADD_CATEGORY_IDS,
  type ExpenseCategoryConfig,
} from './expenseCategories';
import { getDayPart, toDayKey } from '../../utils/dateUtils';
import { buildExpenseFxSnapshot, type FxRateTable } from './fx';
import type { MoneyCurrency } from '../settings/AppSettings';

export const QUICK_ADD_CATEGORIES: ExpenseCategory[] = [...DEFAULT_QUICK_ADD_CATEGORY_IDS];

export interface QuickAddChip {
  category: ExpenseCategory;
  label: string;
  lastAmount?: number;
  currency?: MoneyCurrency;
}

/**
 * Purpose: one-tap pre-configured spend (Morning Coffee, Lunch, MTR) for the Quick Spend Sheet.
 * Inputs: curated list from quickAddTemplates; optional cardId override at tap time.
 * Outputs: JSON-safe template row; View renders icon + label, Controller logs it via buildExpenseDraftFromTemplate.
 * Side effects: none.
 * Design decisions: `icon` is an Ionicons outline name kept as a plain string so Model stays framework-free;
 *   amounts are home-currency defaults she can edit after tap — templates are starting points, not rules.
 */
export interface QuickAddTemplate {
  id: string;
  label: string;
  amount: number;
  currency: MoneyCurrency;
  category: ExpenseCategory;
  note?: string;
  cardId?: string;
  icon: string;
}

export interface QuickAddSuggestion {
  category: ExpenseCategory;
  reason: 'recent' | 'time' | 'merchant' | 'last';
  lastExpense?: Expense;
  /** Smart default amount: last spend logged for the suggested category. */
  suggestedAmount?: number;
  /** Currency of the smart default amount. */
  suggestedCurrency?: MoneyCurrency;
  /** Smart default card: most used card for the suggested category. */
  suggestedCardId?: string;
  chips: QuickAddChip[];
}

/**
 * Purpose: treat a short free-text note as a merchant-ish hint (café name, MTR, Wellcome).
 * Inputs: optional note.
 * Outputs: true when the note looks like a place or shop, not a raw number.
 * Side effects: none.
 */
export function isMerchantishNote(note?: string): boolean {
  const trimmed = note?.trim() ?? '';
  if (trimmed.length < 2 || trimmed.length > 48) {
    return false;
  }
  if (/^[\d.,\s]+$/.test(trimmed)) {
    return false;
  }
  return true;
}

/**
 * Purpose: newest expense in the list (already typically newest-first, but we sort).
 * Inputs: expenses.
 * Outputs: last logged spend or undefined.
 * Side effects: none.
 */
export function lastExpenseOf(expenses: Expense[]): Expense | undefined {
  return [...expenses].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}

/**
 * Purpose: last amount she logged for a category, preferring the given currency.
 * Inputs: expenses, category, preferred currency.
 * Outputs: amount or undefined.
 * Side effects: none.
 */
export function lastAmountForCategory(
  expenses: Expense[],
  category: ExpenseCategory,
  currency?: MoneyCurrency,
): { amount: number; currency: MoneyCurrency } | undefined {
  const match = [...expenses]
    .filter((item) => item.category === category)
    .sort((left, right) => {
      if (currency) {
        const leftHit = left.currency === currency ? 0 : 1;
        const rightHit = right.currency === currency ? 0 : 1;
        if (leftHit !== rightHit) {
          return leftHit - rightHit;
        }
      }
      return right.createdAt.localeCompare(left.createdAt);
    })[0];
  if (!match) {
    return undefined;
  }
  return { amount: match.amount, currency: match.currency };
}

/**
 * Purpose: time-of-day category guess when she has little history.
 * Inputs: now.
 * Outputs: dining / transport / groceries / bills.
 * Side effects: none.
 * Design decisions: commute hours lean transport; meal hours lean dining; late morning lean groceries; evenings after 21 lean bills only if nothing else fits — default dining for meal-ish hours, groceries otherwise.
 */
export function categoryFromTimeOfDay(now: Date = new Date()): ExpenseCategory {
  const hour = now.getHours();
  const part = getDayPart(now);
  if (hour >= 7 && hour < 10) {
    return 'transport';
  }
  if (hour >= 11 && hour < 15) {
    return 'dining';
  }
  if (hour >= 17 && hour < 20) {
    return hour < 19 ? 'transport' : 'dining';
  }
  if (part === 'morning') {
    return 'groceries';
  }
  if (part === 'evening' || part === 'night') {
    return 'dining';
  }
  return 'groceries';
}

/**
 * Purpose: most-used category among recent spends (last 14 days / last 12 rows).
 * Inputs: expenses and now.
 * Outputs: winning category or null when there is no history.
 * Side effects: none.
 */
export function recentCategoryVote(expenses: Expense[], now: Date = new Date()): ExpenseCategory | null {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14).toISOString();
  const recent = expenses.filter((item) => item.createdAt >= cutoff || item.dayKey >= cutoff.slice(0, 10)).slice(0, 12);
  if (recent.length === 0) {
    return null;
  }
  const counts = new Map<ExpenseCategory, number>();
  for (const item of recent) {
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }
  let best: ExpenseCategory | null = null;
  let bestCount = 0;
  for (const [category, count] of counts) {
    if (count > bestCount) {
      best = category;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Purpose: most-used payment card for one category (smart default “paid with”).
 * Inputs: expenses, category.
 * Outputs: cardId with the highest spend count, or undefined when nothing was charged to a card.
 * Side effects: none.
 * Design decisions: pure frequency count over full history; ties resolve to the card that reached
 *   the winning count first (list order), so a long-standing habit beats a one-off.
 */
export function mostUsedCardForCategory(expenses: Expense[], category: ExpenseCategory): string | undefined {
  const counts = new Map<string, number>();
  let best: string | undefined;
  let bestCount = 0;
  for (const item of expenses) {
    if (item.category !== category || !item.cardId) {
      continue;
    }
    const next = (counts.get(item.cardId) ?? 0) + 1;
    counts.set(item.cardId, next);
    if (next > bestCount) {
      best = item.cardId;
      bestCount = next;
    }
  }
  return best;
}

/**
 * Purpose: suggest a spend category from last merchant note, recent pattern, or time of day,
 *   plus Smart Defaults for amount and card so a quick spend is one tap, not a form.
 * Inputs: expenses, now, optional active catalog from settings.
 * Outputs: category plus why, last expense for “same as last time,” smart default amount
 *   (last spend for the suggested category), smart default card (most used for the category),
 *   and one-tap chips.
 * Side effects: none.
 * Design decisions: last merchant-ish note wins; then recent votes; then clock. Chips follow her
 *   active catalog. Amount/card defaults are derived only from the winning category so the whole
 *   suggestion stays internally consistent.
 */
export function suggestQuickAdd(
  expenses: Expense[],
  now: Date = new Date(),
  categories?: ExpenseCategoryConfig[],
): QuickAddSuggestion {
  const lastExpense = lastExpenseOf(expenses);
  let category: ExpenseCategory = categoryFromTimeOfDay(now);
  let reason: QuickAddSuggestion['reason'] = 'time';

  const voted = recentCategoryVote(expenses, now);
  if (voted) {
    category = voted;
    reason = 'recent';
  }

  if (lastExpense && isMerchantishNote(lastExpense.note)) {
    category = lastExpense.category;
    reason = 'merchant';
  } else if (!voted && lastExpense) {
    category = lastExpense.category;
    reason = 'last';
  }

  const smartAmount = lastAmountForCategory(expenses, category, lastExpense?.currency);

  const chipIds = categories ? quickAddCategoryIds(categories) : [...DEFAULT_QUICK_ADD_CATEGORY_IDS];
  const chips: QuickAddChip[] = chipIds.map((id) => {
    const last = lastAmountForCategory(expenses, id, lastExpense?.currency);
    const label = categories
      ? expenseCategoryFallbackLabel(id, categories)
      : (EXPENSE_CATEGORIES.find((item) => item.id === id)?.label ?? id);
    return {
      category: id,
      label,
      lastAmount: last?.amount,
      currency: last?.currency,
    };
  });

  return {
    category,
    reason,
    lastExpense,
    suggestedAmount: smartAmount?.amount,
    suggestedCurrency: smartAmount?.currency,
    suggestedCardId: mostUsedCardForCategory(expenses, category),
    chips,
  };
}

/**
 * Purpose: one-line hint under the amount field.
 * Inputs: suggestion + optional catalog for custom labels.
 * Outputs: short copy, or empty when there is nothing useful to say.
 * Side effects: none.
 */
export function quickAddHint(suggestion: QuickAddSuggestion, categories?: ExpenseCategoryConfig[]): string {
  const label = categories
    ? expenseCategoryFallbackLabel(suggestion.category, categories)
    : (EXPENSE_CATEGORIES.find((item) => item.id === suggestion.category)?.label ?? suggestion.category);
  if (suggestion.reason === 'merchant' && suggestion.lastExpense?.note) {
    return `Looks like ${label} — last time was ${suggestion.lastExpense.note}`;
  }
  if (suggestion.reason === 'recent') {
    return `Usually ${label} lately`;
  }
  if (suggestion.reason === 'last') {
    return `Last spend was ${label}`;
  }
  return `Maybe ${label} around now`;
}

/**
 * Purpose: curated one-tap templates for the Quick Spend Sheet (Morning Coffee, Lunch, MTR).
 * Inputs: optional currency override (defaults to home HKD).
 * Outputs: stable list of QuickAddTemplate; ids are stable so usage stats can key off them later.
 * Side effects: none.
 * Design decisions: amounts are sensible HK everyday defaults, not personalized — personalization
 *   comes from Smart Defaults in suggestQuickAdd; templates stay static so the sheet renders
 *   instantly with zero computation.
 */
export function quickAddTemplates(currency: MoneyCurrency = 'HKD'): QuickAddTemplate[] {
  return [
    {
      id: 'morning-coffee',
      label: 'Morning Coffee',
      amount: 35,
      currency,
      category: 'dining',
      note: 'Coffee',
      icon: 'cafe-outline',
    },
    {
      id: 'lunch',
      label: 'Lunch',
      amount: 80,
      currency,
      category: 'dining',
      note: 'Lunch',
      icon: 'restaurant-outline',
    },
    {
      id: 'mtr-ride',
      label: 'MTR',
      amount: 12,
      currency,
      category: 'transport',
      note: 'MTR',
      icon: 'bus-outline',
    },
  ];
}

/**
 * Purpose: build a complete ExpenseDraft from a one-tap template for the Controller.
 * Inputs: template, local now, optional FX table + card fee for foreign locks.
 * Outputs: ExpenseDraft with dayKey, cardId, and locked FX when foreign.
 * Side effects: none.
 * Design decisions: mirrors buildExpenseDraftFromRecurring so template / recurring / voice paths
 *   all converge on the same draft shape; note falls back to the template label so the spend is
 *   recognizable in lists; never sets recurringSpendId (a template is not a repeat rule).
 */
export function buildExpenseDraftFromTemplate(
  template: QuickAddTemplate,
  now: Date = new Date(),
  fxTable?: FxRateTable | null,
  cardFeeRate: number = 0,
): ExpenseDraft {
  const snapshot = buildExpenseFxSnapshot(template.amount, template.currency, fxTable, cardFeeRate, now);
  return {
    amount: Math.max(0, template.amount),
    currency: template.currency,
    category: template.category,
    dayKey: toDayKey(now),
    note: template.note ?? template.label,
    cardId: template.cardId,
    fx: snapshot ?? (template.currency === 'HKD' ? null : undefined),
  };
}
