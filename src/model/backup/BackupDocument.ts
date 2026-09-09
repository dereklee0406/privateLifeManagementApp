import type { FinanceDocument } from '../finance/Account';
import type { JournalEntry } from '../journal/JournalEntry';
import type { ReminderDocument } from '../reminders/normalizeReminder';
import type { AppSettings } from '../settings/AppSettings';

/**
 * Purpose: versioned inner snapshot of on-device life + money (never the lock PIN).
 * Inputs: assembled by serializeBackup from the four local stores.
 * Outputs: JSON-serializable document encrypted before it is written to a file.
 * Side effects: none.
 * Design decisions: version 1 is a replace-all restore; media stays as URIs, not inlined bytes; PIN/secret never appear here.
 */
export interface BackupDocument {
  version: 1;
  exportedAt: string;
  journal: JournalEntry[];
  reminders: ReminderDocument;
  finance: FinanceDocument;
  settings: AppSettings;
}

export type BackupErrorCode = 'not-halo' | 'wrong-password' | 'corrupt' | 'weak-password' | 'mismatch';

const BACKUP_ERROR_COPY: Record<BackupErrorCode, string> = {
  'not-halo': 'That file isn’t a Halo backup.',
  'wrong-password': 'Wrong password. Nothing on this phone was changed.',
  corrupt: 'This file is damaged.',
  'weak-password': 'Use at least 6 characters.',
  mismatch: 'Those passwords did not match.',
};

/**
 * Purpose: typed failure for backup encrypt, parse, or restore — no partial writes.
 * Inputs: machine code plus optional override copy.
 * Outputs: Error with a girlfriend-simple message.
 * Side effects: none.
 */
export class BackupError extends Error {
  constructor(
    readonly code: BackupErrorCode,
    message?: string,
  ) {
    super(message ?? BACKUP_ERROR_COPY[code]);
    this.name = 'BackupError';
  }
}

/**
 * Purpose: map unknown thrown values to BackupError without leaking crypto internals.
 * Inputs: caught unknown.
 * Outputs: BackupError (passthrough or corrupt).
 * Side effects: none.
 */
export function asBackupError(error: unknown): BackupError {
  if (error instanceof BackupError) {
    return error;
  }
  return new BackupError('corrupt');
}
