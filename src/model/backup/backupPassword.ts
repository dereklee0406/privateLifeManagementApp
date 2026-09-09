import { AppConfig } from '../../config/appConfig';

/**
 * Purpose: backup-password policy (separate from the 4–6 digit app lock PIN).
 * Inputs: none.
 * Outputs: minimum length constant.
 * Side effects: none.
 */
export const BACKUP_PASSWORD_MIN_LENGTH = AppConfig.backup.passwordMinLength;

/**
 * Purpose: accept a backup password before KDF.
 * Inputs: password string from Export / Import.
 * Outputs: true when length is at least the product minimum.
 * Side effects: none.
 * Design decisions: no complexity theatre — girlfriend-simple, min 6; PIN rules stay in pinRules.
 */
export function isBackupPasswordValid(password: string): boolean {
  return password.length >= BACKUP_PASSWORD_MIN_LENGTH;
}

/**
 * Purpose: confirm-field check on Export.
 * Inputs: password and retype.
 * Outputs: true when both are non-empty and equal.
 * Side effects: none.
 */
export function backupPasswordsMatch(password: string, confirm: string): boolean {
  return password.length > 0 && password === confirm;
}
