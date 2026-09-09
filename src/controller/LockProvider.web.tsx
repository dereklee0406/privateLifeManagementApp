/**
 * Purpose: web lock session — PIN in AsyncStorage (no keystore); biometrics unavailable, PIN fallback.
 * Design decisions: same overlay as native so lockMode in settings cannot trap her on a no-op stub.
 *   Never import expo-secure-store / expo-local-authentication here (those stay in *.native.ts adapters).
 */
export { LockProvider, useLock } from './LockSessionProvider';
