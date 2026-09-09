import type { Expense } from '../finance/Expense';
import type { JournalEntry } from '../journal/JournalEntry';
import { backupDayKey } from './serializeBackup';

/**
 * Purpose: escape one CSV field (RFC-style quotes).
 * Inputs: any cell.
 * Outputs: quoted when needed.
 * Side effects: none.
 */
function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Purpose: a readable on-device CSV of spend rows plus page titles (not the encrypted .halo).
 * Inputs: journal pages and spends.
 * Outputs: UTF-8 CSV string with a BOM so spreadsheet apps open it cleanly.
 * Side effects: none.
 * Design decisions: titles and spend notes only — no photo bytes, no PIN, no cloud.
 */
export function buildReadableCsv(entries: JournalEntry[], expenses: Expense[]): string {
  const lines: string[] = ['kind,date,title,amount,currency,category,note'];
  const pages = [...entries].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  for (const page of pages) {
    const date = page.createdAt.slice(0, 10);
    lines.push(
      ['page', date, csvCell(page.title), '', '', '', csvCell(page.moodNote ?? '')].join(','),
    );
  }
  const spends = [...expenses].sort((left, right) => right.dayKey.localeCompare(left.dayKey));
  for (const spend of spends) {
    lines.push(
      [
        'spend',
        spend.dayKey,
        '',
        spend.amount.toFixed(2),
        spend.currency,
        spend.category,
        csvCell(spend.note ?? ''),
      ].join(','),
    );
  }
  return `\uFEFF${lines.join('\n')}\n`;
}

/**
 * Purpose: suggested CSV filename for You → Backup.
 * Inputs: now.
 * Outputs: halo-export-YYYY-MM-DD.csv
 * Side effects: none.
 */
export function readableCsvFilename(now: Date = new Date()): string {
  return `halo-export-${backupDayKey(now)}.csv`;
}
