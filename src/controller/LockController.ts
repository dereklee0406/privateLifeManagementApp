import { isValidPin } from '../model/settings/pinRules';
import { authenticateWithBiometrics, getBiometricCapability, type BiometricCapability } from '../data/biometricAuth';
import { deletePin, hasPin, readPin, savePin } from '../data/pinStore';

export type { BiometricCapability };

/**
 * Purpose: orchestrate PIN + biometrics without UI or settings persistence.
 * Inputs: PIN strings and biometric prompts.
 * Outputs: boolean success and capability snapshots.
 * Side effects: secure-store and local-authentication via platform data adapters.
 * Design decisions: SettingsController only stores lockMode; this class never writes AppSettings.
 */
export class LockController {
  /**
   * Purpose: store a validated PIN in secure storage.
   * Inputs: 4–6 digit string.
   * Outputs: none.
   * Side effects: secure-store write.
   */
  async savePin(pin: string): Promise<void> {
    if (!isValidPin(pin)) {
      throw new Error('PIN must be 4 to 6 digits.');
    }
    await savePin(pin);
  }

  /**
   * Purpose: compare an entered PIN to the stored secret.
   * Inputs: candidate PIN.
   * Outputs: true on match.
   * Side effects: secure-store read.
   */
  async verifyPin(pin: string): Promise<boolean> {
    try {
      const stored = await readPin();
      return Boolean(stored && stored === pin);
    } catch {
      return false;
    }
  }

  /**
   * Purpose: drop the stored PIN when lock is turned off.
   */
  async deletePin(): Promise<void> {
    await deletePin();
  }

  /**
   * Purpose: whether a PIN exists (required before showing the lock screen).
   */
  async hasPin(): Promise<boolean> {
    return hasPin();
  }

  /**
   * Purpose: Face ID / fingerprint availability for the You tab.
   */
  async getBiometricCapability(): Promise<BiometricCapability> {
    return getBiometricCapability();
  }

  /**
   * Purpose: system biometric prompt with PIN as the in-app fallback.
   */
  async authenticateWithBiometrics(): Promise<boolean> {
    return authenticateWithBiometrics();
  }
}
