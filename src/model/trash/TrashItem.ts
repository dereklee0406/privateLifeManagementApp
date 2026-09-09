import type { Expense } from '../finance/Expense';
import type { JournalEntry } from '../journal/JournalEntry';
import { AppConfig } from '../../config/appConfig';

export type TrashKind = 'page' | 'spend';

/**
 * Purpose: a released page or removed spend kept on this phone for a short restore window.
 * Inputs: JournalController / FinanceController delete.
 * Outputs: JSON-serializable trash row (payload is the full page or spend).
 * Side effects: none.
 * Design decisions: media URIs stay on disk until purge so Restore still has photos/voice; not a cloud bin.
 */
export interface TrashItem {
  id: string;
  kind: TrashKind;
  deletedAt: string;
  page?: JournalEntry;
  spend?: Expense;
}

export interface TrashDocument {
  items: TrashItem[];
}

export function emptyTrashDocument(): TrashDocument {
  return { items: [] };
}

/**
 * Purpose: 30-day retain window from deletedAt.
 * Inputs: trash row and now.
 * Outputs: true when Restore should no longer be offered and media may be dropped.
 * Side effects: none.
 */
export function isTrashExpired(item: TrashItem, now: Date = new Date()): boolean {
  const deleted = Date.parse(item.deletedAt);
  if (!Number.isFinite(deleted)) {
    return true;
  }
  const retainMs = AppConfig.trash.retainDays * 24 * 60 * 60 * 1000;
  return now.getTime() - deleted > retainMs;
}

/**
 * Purpose: girlfriend-simple remaining-days copy for Recently deleted.
 * Inputs: trash row and now.
 * Outputs: e.g. “12 days left”.
 * Side effects: none.
 */
export function trashDaysLeft(item: TrashItem, now: Date = new Date()): number {
  const deleted = Date.parse(item.deletedAt);
  if (!Number.isFinite(deleted)) {
    return 0;
  }
  const retainMs = AppConfig.trash.retainDays * 24 * 60 * 60 * 1000;
  const left = retainMs - (now.getTime() - deleted);
  return Math.max(0, Math.ceil(left / (24 * 60 * 60 * 1000)));
}
