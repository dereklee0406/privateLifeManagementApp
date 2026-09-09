import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppConfig } from '../config/appConfig';

/**
 * Purpose: persist the lock PIN on web (no OS keystore).
 * Inputs: 4–6 digit PIN string.
 * Outputs: none.
 * Side effects: AsyncStorage write under the dedicated PIN key (never mixed into settings JSON / backup).
 * Design decisions: same key as native so LockController compare is identical; no expo-secure-store import.
 */
export async function savePin(pin: string): Promise<void> {
  await AsyncStorage.setItem(AppConfig.storage.pinKey, pin);
}

/**
 * Purpose: read the stored PIN for verification.
 * Inputs: none.
 * Outputs: PIN string or null.
 * Side effects: AsyncStorage read.
 */
export async function readPin(): Promise<string | null> {
  return AsyncStorage.getItem(AppConfig.storage.pinKey);
}

/**
 * Purpose: remove the PIN when lock is disabled.
 * Inputs: none.
 * Outputs: none.
 * Side effects: deletes the AsyncStorage item.
 */
export async function deletePin(): Promise<void> {
  await AsyncStorage.removeItem(AppConfig.storage.pinKey);
}

/**
 * Purpose: whether a PIN currently exists.
 * Inputs: none.
 * Outputs: true when a value is stored.
 * Side effects: AsyncStorage read.
 */
export async function hasPin(): Promise<boolean> {
  const stored = await readPin();
  return Boolean(stored);
}
