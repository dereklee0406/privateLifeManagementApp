import type { Expense } from '../finance/Expense';
import { formatMoney } from '../finance/Expense';
import type { JournalEntry } from '../journal/JournalEntry';
import { stripMarkdown } from '../journal/markdown';
import { describeCategoryPath } from '../reminders/categories';
import type { Reminder } from '../reminders/Reminder';

export type GlobalSearchFilter = 'all' | 'pages' | 'reminders' | 'money';

export type GlobalSearchKind = 'page' | 'reminder' | 'spend';

export interface GlobalSearchHit {
  kind: GlobalSearchKind;
  id: string;
  title: string;
  snippet: string;
}

export interface GlobalSearchInput {
  query: string;
  filter: GlobalSearchFilter;
  entries: JournalEntry[];
  reminders: Reminder[];
  expenses: Expense[];
}

/**
 * Purpose: one on-device search over pages, reminders, and spends.
 * Inputs: keyword string, kind filter, and the three lists.
 * Outputs: hits newest-feeling first (pages by createdAt, spends by day, reminders by title).
 * Side effects: none.
 * Design decisions: pure filter — no ranking theater. Empty query returns [] so the View can show the Pages timeline instead. Amount matches digits inside formatMoney or the raw number. Page keywords include the optional mood note.
 */
export function searchGlobal(input: GlobalSearchInput): GlobalSearchHit[] {
  const needle = input.query.trim().toLowerCase();
  if (!needle) {
    return [];
  }
  const want = input.filter;
  const hits: GlobalSearchHit[] = [];

  if (want === 'all' || want === 'pages') {
    for (const entry of input.entries) {
      const tags = entry.tags.join(' ');
      const haystack = `${entry.title} ${entry.body} ${entry.moodNote ?? ''} ${tags}`.toLowerCase();
      if (!haystack.includes(needle)) {
        continue;
      }
      const preview = stripMarkdown(entry.body).trim() || entry.moodNote?.trim() || '';
      hits.push({
        kind: 'page',
        id: entry.id,
        title: entry.title.trim() || 'Untitled page',
        snippet: preview ? preview.slice(0, 120) : entry.tags.map((tag) => `#${tag}`).join(' '),
      });
    }
  }

  if (want === 'all' || want === 'reminders') {
    for (const item of input.reminders) {
      const path = describeCategoryPath(item.categoryPath);
      const haystack = `${item.title} ${item.note ?? ''} ${path}`.toLowerCase();
      if (!haystack.includes(needle)) {
        continue;
      }
      hits.push({
        kind: 'reminder',
        id: item.id,
        title: item.title.trim() || 'Reminder',
        snippet: item.note?.trim() || path,
      });
    }
  }

  if (want === 'all' || want === 'money') {
    for (const item of input.expenses) {
      const amountLabel = formatMoney(item.amount, item.currency);
      const haystack = `${item.note ?? ''} ${item.category} ${amountLabel} ${item.amount} ${item.dayKey}`.toLowerCase();
      if (!haystack.includes(needle)) {
        continue;
      }
      hits.push({
        kind: 'spend',
        id: item.id,
        title: amountLabel,
        snippet: [item.category, item.note, item.dayKey].filter(Boolean).join(' · '),
      });
    }
  }

  return hits;
}

/**
 * Purpose: browse lists when a kind chip is on but she has not typed yet.
 * Inputs: same bags as searchGlobal, plus the active filter.
 * Outputs: reminder or spend hits (pages stay on the timeline in the View).
 * Side effects: none.
 */
export function browseGlobalKind(
  filter: GlobalSearchFilter,
  reminders: Reminder[],
  expenses: Expense[],
): GlobalSearchHit[] {
  if (filter === 'reminders') {
    return reminders.map((item) => ({
      kind: 'reminder' as const,
      id: item.id,
      title: item.title.trim() || 'Reminder',
      snippet: item.note?.trim() || describeCategoryPath(item.categoryPath),
    }));
  }
  if (filter === 'money') {
    return [...expenses]
      .sort((left, right) => right.dayKey.localeCompare(left.dayKey) || right.createdAt.localeCompare(left.createdAt))
      .slice(0, 30)
      .map((item) => ({
        kind: 'spend' as const,
        id: item.id,
        title: formatMoney(item.amount, item.currency),
        snippet: [item.category, item.note, item.dayKey].filter(Boolean).join(' · '),
      }));
  }
  return [];
}
