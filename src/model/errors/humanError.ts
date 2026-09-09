import { BackupError, type BackupErrorCode } from '../backup/BackupDocument';

const BACKUP_ERROR_KEYS: Record<BackupErrorCode, string> = {
  'not-halo': 'errors.backup.notHalo',
  'wrong-password': 'errors.backup.wrongPassword',
  corrupt: 'errors.backup.corrupt',
  'weak-password': 'errors.backup.weakPassword',
  mismatch: 'errors.backup.mismatch',
};

/**
 * Purpose: map a caught failure to a View catalog key — never a stack trace.
 * Inputs: caught unknown plus a fallback key (e.g. backup.saveFailed).
 * Outputs: i18n key for t().
 * Side effects: none.
 * Design decisions: BackupError uses its machine code; share/network stay kind-based.
 *   Copy lives in View catalogs. humanError() keeps English for any leftover caller.
 */
export function humanErrorKey(error: unknown, fallbackKey: string): string {
  if (error instanceof BackupError) {
    return BACKUP_ERROR_KEYS[error.code];
  }
  if (error instanceof Error) {
    const text = error.message.toLowerCase();
    if (text.includes('share') || text.includes('sharing')) {
      return 'errors.share';
    }
    if (text.includes('network') || text.includes('fetch') || text.includes('internet')) {
      return 'errors.network';
    }
  }
  return fallbackKey;
}

/**
 * Purpose: girlfriend-simple failure copy — never a stack trace.
 * Inputs: caught unknown plus a fallback sentence.
 * Outputs: short human message (English). Prefer humanErrorKey + t() in views.
 * Side effects: none.
 * Design decisions: BackupError already carries copy; share/network/FX failures use the fallback.
 */
export function humanError(error: unknown, fallback: string): string {
  if (error instanceof BackupError) {
    return error.message;
  }
  if (error instanceof Error) {
    const text = error.message.toLowerCase();
    if (text.includes('share') || text.includes('sharing')) {
      return 'Could not save the file. Try again, or pick another folder.';
    }
    if (text.includes('network') || text.includes('fetch') || text.includes('internet')) {
      return 'That needs a connection. Try again when you are online.';
    }
  }
  return fallback;
}
