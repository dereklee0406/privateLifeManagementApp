import * as SecureStore from 'expo-secure-store';
import { AppConfig } from '../config/appConfig';

/**
 * Purpose: persist the lock PIN in the OS keystore / keychain.
 * Inputs: 4–6 digit PIN string.
 * Outputs: none.
 * Side effects: expo-secure-store write. Never AsyncStorage.
 * Design decisions: native-only file so web Metro never evaluates expo-secure-store.
 */
export async function savePin(pin: string): Promise<void> {
  await SecureStore.setItemAsync(AppConfig.storage.pinKey, pin);
}

/**
 * Purpose: read the stored PIN for verification.
 * Inputs: none.
 * Outputs: PIN string or null.
 * Side effects: expo-secure-store read.
 */
export async function readPin(): Promise<string | null> {
  return SecureStore.getItemAsync(AppConfig.storage.pinKey);
}

/**
 * Purpose: remove the PIN when lock is disabled.
 * Inputs: none.
 * Outputs: none.
 * Side effects: deletes the secure-store item.
 */
export async function deletePin(): Promise<void> {
  await SecureStore.deleteItemAsync(AppConfig.storage.pinKey);
}

/**
 * Purpose: whether a PIN currently exists in secure storage.
 * Inputs: none.
 * Outputs: true when a value is stored.
 * Side effects: secure-store read.
 */
export async function hasPin(): Promise<boolean> {
  const stored = await readPin();
  return Boolean(stored);
}
