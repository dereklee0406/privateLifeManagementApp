import { Ionicons } from '@expo/vector-icons';
import { ASSET_KINDS } from '../../model/finance/Asset';
import { EXPENSE_CATEGORIES, iconNameForExpenseCategory, type ExpenseCategoryConfig } from '../../model/finance/expenseCategories';
import { INCOME_KINDS } from '../../model/finance/Income';
import { LOAN_KINDS } from '../../model/finance/Loan';
import { findCategoryNode } from '../../model/reminders/categories';
import {
  findReminderTypeConfig,
  reminderTypeConfiguredIcon,
  type ConfigurableReminderType,
} from '../../model/reminders/reminderTypes';
import type { ReminderCategoryPath } from '../../model/reminders/Reminder';
import { getReminderTemplate } from '../../model/reminders/templates';
import type { Translate } from '../i18n';

/**
 * Purpose: SF-like Ionicons glyph names used for Halo types (categories, kinds, money accounts).
 * Inputs: @expo/vector-icons glyph map.
 * Outputs: name union for TypeIcon / Chip.
 * Side effects: none.
 */
export type TypeIconName = keyof typeof Ionicons.glyphMap;

/** Filter / picker type icons — ~22pt in a 44pt chip. */
export const TYPE_ICON_SIZE = 22;

/** Calendar day-cell type marker — small enough to sit with mood/spend dots. */
export const CALENDAR_TYPE_ICON_SIZE = 12;

const FALLBACK_ICON: TypeIconName = 'ellipse-outline';

/**
 * Purpose: one outline glyph per stored type id (reminder tree, spend, loan, asset, income, kind, template).
 * Inputs: stable ids from Model catalogs — no new products.
 * Outputs: Ionicons iOS-style outline name.
 * Side effects: none.
 * Design decisions: outline (not emoji) so wrapping Calendar reminder filters stay 44pt and do not clip Vehicle;
 *   mortgage is home-outline (user family), household is bed-outline so the two homes do not collide.
 */
const TYPE_ICONS: Record<string, TypeIconName> = {
  financial: 'wallet-outline',
  'credit-card': 'card-outline',
  loan: 'cash-outline',
  mortgage: 'home-outline',
  'personal-loan': 'person-outline',
  'car-loan': 'car-outline',
  bills: 'receipt-outline',
  electricity: 'flash-outline',
  water: 'water-outline',
  gas: 'flame-outline',
  internet: 'wifi-outline',
  mobile: 'phone-portrait-outline',
  investments: 'trending-up-outline',
  'monthly-etf': 'stats-chart-outline',
  'mpf-review': 'shield-checkmark-outline',
  'portfolio-review': 'pie-chart-outline',
  health: 'heart-outline',
  medication: 'medkit-outline',
  'daily-medicine': 'medkit-outline',
  vitamins: 'nutrition-outline',
  exercise: 'fitness-outline',
  gym: 'barbell-outline',
  running: 'walk-outline',
  walking: 'walk-outline',
  medical: 'pulse-outline',
  'dental-check': 'happy-outline',
  'eye-check': 'eye-outline',
  'body-check': 'body-outline',
  household: 'bed-outline',
  family: 'people-outline',
  vehicle: 'car-outline',
  work: 'briefcase-outline',
  personal: 'person-outline',
  other: 'ellipsis-horizontal-outline',
  dining: 'restaurant-outline',
  transport: 'bus-outline',
  groceries: 'cart-outline',
  shopping: 'bag-outline',
  entertainment: 'film-outline',
  cash: 'cash-outline',
  bank: 'business-outline',
  investment: 'trending-up-outline',
  property: 'home-outline',
  salary: 'wallet-outline',
  bonus: 'gift-outline',
  car: 'car-outline',
  'follow-up': 'chatbubble-ellipses-outline',
  goal: 'flag-outline',
  reflection: 'journal-outline',
  anniversary: 'gift-outline',
  plain: 'create-outline',
  certification: 'school-outline',
  subscription: 'refresh-outline',
};

const KIND_FALLBACK: Record<string, string> = {
  'follow-up': 'Follow up',
  goal: 'Goal',
  reflection: 'Reflection',
  anniversary: 'Anniversary',
};

/**
 * Purpose: Ionicons name for a type id.
 * Inputs: category / kind / template / money-account id.
 * Outputs: outline glyph; unknown ids get ellipse-outline.
 * Side effects: none.
 */
export function iconForType(id: string | undefined): TypeIconName {
  if (!id) {
    return FALLBACK_ICON;
  }
  return TYPE_ICONS[id] ?? FALLBACK_ICON;
}

/**
 * Purpose: Ionicons for a reminder top type using her settings catalog (custom icons).
 * Inputs: type id + resolved reminderTypes from AppSettings.
 * Outputs: curated outline; falls back to iconForType / ellipse.
 * Side effects: none.
 */
export function iconForReminderType(id: string | undefined, types: ConfigurableReminderType[]): TypeIconName {
  if (!id) {
    return FALLBACK_ICON;
  }
  const fromCatalog = reminderTypeConfiguredIcon(id, types);
  if (fromCatalog && fromCatalog in Ionicons.glyphMap) {
    return fromCatalog as TypeIconName;
  }
  return iconForType(id);
}

/**
 * Purpose: display label for a reminder top type (custom name or i18n builtin).
 * Inputs: translator, id, resolved catalog.
 * Outputs: custom typed label, else types.{id}, else English fallback.
 * Side effects: none.
 */
export function reminderTypeLabel(t: Translate, id: string, types: ConfigurableReminderType[]): string {
  const row = findReminderTypeConfig(types, id);
  if (row?.label) {
    return row.label;
  }
  return typeA11yLabel(t, id);
}

/**
 * Purpose: Ionicons for a spend category using her settings catalog (custom icons).
 * Inputs: category id + resolved expenseCategories from AppSettings.
 * Outputs: curated outline; falls back to iconForType / ellipse.
 * Side effects: none.
 */
export function iconForExpenseCategory(id: string | undefined, categories: ExpenseCategoryConfig[]): TypeIconName {
  if (!id) {
    return FALLBACK_ICON;
  }
  const fromCatalog = iconNameForExpenseCategory(id, categories);
  if (fromCatalog in Ionicons.glyphMap) {
    return fromCatalog as TypeIconName;
  }
  return iconForType(id);
}

/**
 * Purpose: display label for a spend category (custom name or i18n builtin).
 * Inputs: translator, id, resolved catalog.
 * Outputs: custom typed label, else types.{id}, else English fallback.
 * Side effects: none.
 */
export function expenseCategoryLabel(t: Translate, id: string, categories: ExpenseCategoryConfig[]): string {
  const row = categories.find((item) => item.id === id);
  if (row?.label) {
    return row.label;
  }
  return typeA11yLabel(t, id);
}

/**
 * Purpose: most-specific reminder type for list rows and calendar markers.
 * Inputs: stored category path and optional template id.
 * Outputs: type → subcategory → top → template → other.
 * Side effects: none.
 */
export function iconIdForReminder(path?: ReminderCategoryPath, templateId?: string): string {
  return path?.type || path?.subcategory || path?.top || templateId || 'other';
}

/**
 * Purpose: English label when `t('types.*')` is missing.
 * Inputs: type id.
 * Outputs: Model catalog label, or the raw id.
 * Side effects: none.
 */
export function typeFallbackLabel(id: string): string {
  const node = findCategoryNode(id);
  if (node) {
    return node.label;
  }
  const expense = EXPENSE_CATEGORIES.find((row) => row.id === id);
  if (expense) {
    return expense.label;
  }
  const loan = LOAN_KINDS.find((row) => row.id === id);
  if (loan) {
    return loan.label;
  }
  const asset = ASSET_KINDS.find((row) => row.id === id);
  if (asset) {
    return asset.label;
  }
  const income = INCOME_KINDS.find((row) => row.id === id);
  if (income) {
    return income.label;
  }
  const template = getReminderTemplate(id);
  if (template) {
    return template.label;
  }
  return KIND_FALLBACK[id] ?? id;
}

/**
 * Purpose: VoiceOver / TalkBack / web tooltip copy for a type icon.
 * Inputs: translator, type id, optional English fallback.
 * Outputs: catalog `types.{id}` when present; otherwise English (or Model label).
 * Side effects: none.
 * Design decisions: missing keys fall through i18n-js to English, then to Model labels — no new types.
 */
export function typeA11yLabel(t: Translate, id: string, english?: string): string {
  const key = `types.${id}`;
  const translated = t(key);
  if (translated && translated !== key) {
    return translated;
  }
  return english ?? typeFallbackLabel(id);
}
