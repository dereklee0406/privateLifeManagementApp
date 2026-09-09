/**
 * Purpose: configurable spend category catalog (You → Money → Expense categories).
 * Inputs: AppSettings.expenseCategories or defaults; add/hide/reorder actions from settings UI.
 * Outputs: normalized ExpenseCategoryConfig lists; active ids for Log a spend / Money chips.
 * Side effects: none — persistence is SettingsController / AsyncStorage.
 * Design decisions: category id is a free string so custom rows do not force a TS union change;
 *   builtins keep stable ids for i18n `types.*` and old spends; soft-hide (active:false) so
 *   existing expenses never crash; `other` always stays active as the safe bucket.
 */

/** Stored on Expense.category — builtins + custom-{id}. */
export type ExpenseCategory = string;

/**
 * Curated Ionicons outline names for pickers (View maps to glyphMap).
 * Keep in Model so settings JSON stays framework-free.
 */
export const EXPENSE_CATEGORY_ICON_CHOICES = [
  'restaurant-outline',
  'cart-outline',
  'bus-outline',
  'receipt-outline',
  'bag-outline',
  'film-outline',
  'heart-outline',
  'cafe-outline',
  'airplane-outline',
  'paw-outline',
  'shirt-outline',
  'book-outline',
  'game-controller-outline',
  'gift-outline',
  'home-outline',
  'fitness-outline',
  'medkit-outline',
  'phone-portrait-outline',
  'wifi-outline',
  'car-outline',
  'musical-notes-outline',
  'cut-outline',
  'balloon-outline',
  'ellipsis-horizontal-outline',
] as const;

export type ExpenseCategoryIconName = (typeof EXPENSE_CATEGORY_ICON_CHOICES)[number];

export interface ExpenseCategoryConfig {
  id: ExpenseCategory;
  /**
   * Custom display name she typed. Builtins omit this and use i18n `types.{id}`.
   */
  label?: string;
  /** Ionicons outline name from EXPENSE_CATEGORY_ICON_CHOICES (or a known builtin map). */
  icon: ExpenseCategoryIconName;
  /** When false, hidden from pickers; still resolvable for old spends. */
  active: boolean;
  /** Built-in catalog row — hide instead of hard-delete; label comes from i18n. */
  builtin?: boolean;
}

const BUILTIN_DEFAULTS: ReadonlyArray<{
  id: ExpenseCategory;
  label: string;
  icon: ExpenseCategoryIconName;
}> = [
  { id: 'dining', label: 'Dining', icon: 'restaurant-outline' },
  { id: 'groceries', label: 'Groceries', icon: 'cart-outline' },
  { id: 'transport', label: 'Transport', icon: 'bus-outline' },
  { id: 'bills', label: 'Bills', icon: 'receipt-outline' },
  { id: 'shopping', label: 'Shopping', icon: 'bag-outline' },
  { id: 'entertainment', label: 'Entertainment', icon: 'film-outline' },
  { id: 'health', label: 'Health', icon: 'heart-outline' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

/** English fallback labels for builtins (View prefers i18n). */
export const EXPENSE_CATEGORIES: Array<{ id: ExpenseCategory; label: string }> = BUILTIN_DEFAULTS.map(
  (row) => ({ id: row.id, label: row.label }),
);

export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategoryConfig[] = BUILTIN_DEFAULTS.map((row) => ({
  id: row.id,
  icon: row.icon,
  active: true,
  builtin: true,
}));

/** Everyday quick-add chips when she has not customized (first four builtins). */
export const DEFAULT_QUICK_ADD_CATEGORY_IDS: ExpenseCategory[] = [
  'dining',
  'transport',
  'groceries',
  'bills',
];

const ICON_SET = new Set<string>(EXPENSE_CATEGORY_ICON_CHOICES);

/**
 * Purpose: snap an unknown icon string onto the curated allowlist.
 * Inputs: raw icon from backup / settings JSON.
 * Outputs: a known outline name (defaults to ellipsis).
 * Side effects: none.
 */
export function resolveExpenseCategoryIcon(raw: unknown, fallback: ExpenseCategoryIconName = 'ellipsis-horizontal-outline'): ExpenseCategoryIconName {
  if (typeof raw === 'string' && ICON_SET.has(raw)) {
    return raw as ExpenseCategoryIconName;
  }
  return fallback;
}

/**
 * Purpose: hydrate one category row from settings / backup JSON.
 * Inputs: unknown object.
 * Outputs: config or null when junk.
 * Side effects: none.
 */
export function normalizeExpenseCategoryConfig(raw: unknown): ExpenseCategoryConfig | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== 'string' || !value.id.trim()) {
    return null;
  }
  const id = value.id.trim();
  const builtinMeta = BUILTIN_DEFAULTS.find((row) => row.id === id);
  const builtin = value.builtin === true || Boolean(builtinMeta);
  const label =
    typeof value.label === 'string' && value.label.trim() && !builtin ? value.label.trim() : undefined;
  const icon = resolveExpenseCategoryIcon(
    value.icon,
    builtinMeta?.icon ?? 'ellipsis-horizontal-outline',
  );
  const active = id === 'other' ? true : value.active !== false;
  return { id, label, icon, active, builtin: builtin || undefined };
}

/**
 * Purpose: ensure a usable ordered catalog; always keep `other` active.
 * Inputs: optional stored list (undefined = fresh defaults).
 * Outputs: normalized ExpenseCategoryConfig[].
 * Side effects: none.
 * Design decisions: missing field → full default list (shopping + entertainment included);
 *   corrupted rows dropped; duplicate ids keep the first; `other` forced active at end if missing.
 */
export function resolveExpenseCategories(
  settings: { expenseCategories?: ExpenseCategoryConfig[] } | null | undefined,
): ExpenseCategoryConfig[] {
  const raw = settings?.expenseCategories;
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_EXPENSE_CATEGORIES.map((row) => ({ ...row }));
  }
  const seen = new Set<string>();
  const list: ExpenseCategoryConfig[] = [];
  for (const item of raw) {
    const row = normalizeExpenseCategoryConfig(item);
    if (!row || seen.has(row.id)) {
      continue;
    }
    seen.add(row.id);
    list.push(row);
  }
  if (list.length === 0) {
    return DEFAULT_EXPENSE_CATEGORIES.map((row) => ({ ...row }));
  }
  const other = list.find((row) => row.id === 'other');
  if (!other) {
    list.push({
      id: 'other',
      icon: 'ellipsis-horizontal-outline',
      active: true,
      builtin: true,
    });
  } else {
    other.active = true;
    other.builtin = true;
    other.icon = 'ellipsis-horizontal-outline';
    other.label = undefined;
  }
  return list;
}

/**
 * Purpose: categories shown on Log a spend / Money filter / quick add.
 * Inputs: resolved catalog.
 * Outputs: active rows only, stable order.
 * Side effects: none.
 */
export function activeExpenseCategories(categories: ExpenseCategoryConfig[]): ExpenseCategoryConfig[] {
  return categories.filter((row) => row.active);
}

/**
 * Purpose: quick-add chip ids from her active list (everyday first, then the rest; skip other).
 * Inputs: resolved catalog.
 * Outputs: up to 6 active ids for Money / Log chips.
 * Side effects: none.
 */
export function quickAddCategoryIds(categories: ExpenseCategoryConfig[]): ExpenseCategory[] {
  const active = activeExpenseCategories(categories).filter((row) => row.id !== 'other');
  if (active.length === 0) {
    return [...DEFAULT_QUICK_ADD_CATEGORY_IDS];
  }
  const preferred = DEFAULT_QUICK_ADD_CATEGORY_IDS.filter((id) => active.some((row) => row.id === id));
  const rest = active.map((row) => row.id).filter((id) => !preferred.includes(id));
  return [...preferred, ...rest].slice(0, 6);
}

/**
 * Purpose: English / custom label for a category id (View still prefers i18n for builtins).
 * Inputs: id and resolved catalog.
 * Outputs: custom label, builtin English fallback, or raw id.
 * Side effects: none.
 */
export function expenseCategoryFallbackLabel(id: string, categories: ExpenseCategoryConfig[]): string {
  const row = categories.find((item) => item.id === id);
  if (row?.label) {
    return row.label;
  }
  const builtin = EXPENSE_CATEGORIES.find((item) => item.id === id);
  return builtin?.label ?? id;
}

/**
 * Purpose: look up icon for a spend category (including soft-hidden).
 * Inputs: id and resolved catalog.
 * Outputs: curated icon name.
 * Side effects: none.
 */
export function iconNameForExpenseCategory(
  id: string,
  categories: ExpenseCategoryConfig[],
): ExpenseCategoryIconName {
  const row = categories.find((item) => item.id === id);
  if (row) {
    return row.icon;
  }
  const builtin = BUILTIN_DEFAULTS.find((item) => item.id === id);
  return builtin?.icon ?? 'ellipsis-horizontal-outline';
}

/**
 * Purpose: whether an id is allowed when saving / deep-linking a spend.
 * Inputs: id and catalog (active or soft-hidden both ok so old spends stay editable).
 * Outputs: true when known or non-empty custom-looking id.
 * Side effects: none.
 * Design decisions: unknown deep-link ids still accepted so we do not drop query params;
 *   empty → false.
 */
export function isKnownExpenseCategory(id: string | undefined, categories: ExpenseCategoryConfig[]): boolean {
  if (!id || !id.trim()) {
    return false;
  }
  if (categories.some((row) => row.id === id)) {
    return true;
  }
  return EXPENSE_CATEGORIES.some((row) => row.id === id);
}

/**
 * Purpose: add a custom category at the end (before forcing other last visually is caller’s job).
 * Inputs: current list, display name, icon.
 * Outputs: new list or same list when name empty.
 * Side effects: none.
 */
export function addCustomExpenseCategory(
  categories: ExpenseCategoryConfig[],
  label: string,
  icon: ExpenseCategoryIconName,
): ExpenseCategoryConfig[] {
  const trimmed = label.trim();
  if (!trimmed) {
    return categories;
  }
  const id = `custom-${Date.now().toString(36)}`;
  const next = resolveExpenseCategories({ expenseCategories: categories });
  const withoutOther = next.filter((row) => row.id !== 'other');
  const other = next.find((row) => row.id === 'other') ?? {
    id: 'other',
    icon: 'ellipsis-horizontal-outline' as const,
    active: true,
    builtin: true,
  };
  return [
    ...withoutOther,
    { id, label: trimmed, icon: resolveExpenseCategoryIcon(icon), active: true },
    { ...other, active: true, builtin: true },
  ];
}

/**
 * Purpose: soft-hide a category (or hard-remove a custom row).
 * Inputs: current list, id to remove; hardRemove for custom.
 * Outputs: updated list; never removes or hides `other`.
 * Side effects: none.
 */
export function removeExpenseCategory(
  categories: ExpenseCategoryConfig[],
  id: string,
  hardRemove = false,
): ExpenseCategoryConfig[] {
  if (id === 'other') {
    return categories;
  }
  const next = resolveExpenseCategories({ expenseCategories: categories });
  if (hardRemove) {
    return next.filter((row) => row.id !== id);
  }
  return next.map((row) => (row.id === id ? { ...row, active: false } : row));
}

/**
 * Purpose: move an active category up or down among other active rows.
 * Inputs: catalog, id, direction.
 * Outputs: reordered list (inactive rows keep their slots; swap with nearest active neighbor).
 * Side effects: none.
 */
export function moveExpenseCategory(
  categories: ExpenseCategoryConfig[],
  id: string,
  direction: 'up' | 'down',
): ExpenseCategoryConfig[] {
  const next = resolveExpenseCategories({ expenseCategories: categories });
  const activeIndexes = next
    .map((row, index) => (row.active ? index : -1))
    .filter((index) => index >= 0);
  const position = activeIndexes.findIndex((index) => next[index]?.id === id);
  if (position < 0) {
    return next;
  }
  const swapWith = direction === 'up' ? position - 1 : position + 1;
  if (swapWith < 0 || swapWith >= activeIndexes.length) {
    return next;
  }
  const left = activeIndexes[position];
  const right = activeIndexes[swapWith];
  const copy = [...next];
  const tmp = copy[left];
  copy[left] = copy[right];
  copy[right] = tmp;
  return copy;
}

/**
 * Purpose: restore the shipping default catalog (builtins all active).
 * Inputs: none.
 * Outputs: fresh DEFAULT_EXPENSE_CATEGORIES clone.
 * Side effects: none.
 */
export function resetExpenseCategories(): ExpenseCategoryConfig[] {
  return DEFAULT_EXPENSE_CATEGORIES.map((row) => ({ ...row }));
}
