import { EXPENSE_CATEGORIES, formatFriendlyMoney, type Expense, type ExpenseCategory } from './Expense';

export interface RecentSpendAction {
  key: string;
  label: string;
  amount: number;
  currency: Expense['currency'];
  category: ExpenseCategory;
  note: string;
  cardId?: string;
}

/**
 * Purpose: one-tap spend history chips (“Coffee HK$35”) from local expenses.
 * Inputs: expenses, optional limit (default 6).
 * Outputs: unique recent actions newest first; empty when she has not spent yet.
 * Side effects: none.
 * Design decisions: dedupe by category + amount + currency + note so the same coffee is one chip;
 *   date is not part of the action — the spend form always stamps today.
 */
export function recentSpendActions(expenses: Expense[], limit = 6): RecentSpendAction[] {
  const seen = new Set<string>();
  const rows: RecentSpendAction[] = [];
  const newest = [...expenses].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  for (const item of newest) {
    const note = item.note?.trim() ?? '';
    const key = `${item.category}|${item.amount}|${item.currency}|${note.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const categoryLabel = EXPENSE_CATEGORIES.find((row) => row.id === item.category)?.label ?? item.category;
    const money = formatFriendlyMoney(item.amount, item.currency);
    rows.push({
      key,
      label: note ? `${note} ${money}` : `${categoryLabel} ${money}`,
      amount: item.amount,
      currency: item.currency,
      category: item.category,
      note,
      cardId: item.cardId,
    });
    if (rows.length >= limit) {
      break;
    }
  }
  return rows;
}
