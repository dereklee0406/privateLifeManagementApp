import * as ExpoCrypto from 'expo-crypto';

/**
 * Purpose: make crypto.getRandomValues available for backup KDF/IV on Android/iOS.
 * Inputs: none.
 * Outputs: none.
 * Side effects: polyfills globalThis.crypto.getRandomValues via expo-crypto when missing.
 * Design decisions: native-only so web never loads this file; Web Crypto already has getRandomValues.
 */
export function ensureCsprng(): void {
  const existing = globalThis.crypto;
  if (existing && typeof existing.getRandomValues === 'function') {
    return;
  }
  const getRandomValues = <T extends ArrayBufferView>(typedArray: T): T => {
    const bytes = ExpoCrypto.getRandomBytes(typedArray.byteLength);
    const view = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
    view.set(bytes);
    return typedArray;
  };
  if (existing) {
    existing.getRandomValues = getRandomValues;
    return;
  }
  (globalThis as unknown as { crypto: { getRandomValues: typeof getRandomValues } }).crypto = {
    getRandomValues,
  };
}
