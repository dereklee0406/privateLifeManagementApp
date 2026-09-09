import type { LockMode } from './AppSettings';

/**
 * Purpose: validate an in-app PIN before it is written to secure storage.
 * Inputs: digit string from the PIN pad.
 * Outputs: true when length is 4–6 and every character is a digit.
 * Side effects: none.
 * Design decisions: rules live in Model so Views never invent PIN policy; min/max match AppConfig.lock.
 */
export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

/**
 * Purpose: backup never contains the PIN, so restore cannot leave lock on without a stored secret.
 * Inputs: lockMode from the backup; whether this device already has a PIN.
 * Outputs: 'off' when there is no PIN to verify; otherwise the backup lockMode.
 * Side effects: none.
 */
export function lockModeAfterRestore(lockMode: LockMode, hasStoredPin: boolean): LockMode {
  if (lockMode === 'off' || !hasStoredPin) {
    return 'off';
  }
  return lockMode;
}
