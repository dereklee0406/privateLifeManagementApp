/**
 * Purpose: Android/iOS lock session — PIN in expo-secure-store, Face ID / fingerprint when enrolled.
 * Design decisions: implementation lives in LockSessionProvider so web and native share one overlay.
 */
export { LockProvider, useLock } from './LockSessionProvider';
