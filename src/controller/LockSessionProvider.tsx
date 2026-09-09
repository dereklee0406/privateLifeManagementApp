import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Modal, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSettings } from './SettingsProvider';
import { LockController } from './LockController';
import { lockAfterTimeoutMs } from '../model/settings/AppSettings';
import { LockScreen } from '../view/screens/LockScreen';

interface LockContextValue {
  locked: boolean;
  /** True once settings are ready and, if lock is on, the PIN probe has finished. */
  authResolved: boolean;
  biometricAvailable: boolean;
  biometricLabel: string;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<boolean>;
  savePin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  deletePin: () => Promise<void>;
  hasStoredPin: () => Promise<boolean>;
  refreshBiometrics: () => Promise<void>;
}

const LockContext = createContext<LockContextValue | null>(null);

/**
 * Purpose: session lock overlay (PIN + optional biometrics) shared by phone and web.
 * Inputs: settings.lockMode; children tree.
 * Outputs: lock API for You tab and the lock screen.
 * Side effects: AppState timeout from AppSettings.lockAfterSeconds (0 / 60 / 300s); PIN / biometrics via LockController.
 * Design decisions: Modal content is wrapped in GestureHandlerRootView so PinPad Pressables
 *   receive taps (RNGH root in the app shell does not cover RN Modal). Cold start is fail-closed:
 *   when lockMode !== 'off', treat PIN-unknown as locked so pages/money never flash. Splash stays
 *   until authResolved. Turning lock off unlocks. Enabling lock does not immediately re-lock the
 *   session she is already in (avoids a nested lock Modal over PIN setup).
 */
export function LockProvider({ children }: { children: ReactNode }) {
  const { ready, settings } = useSettings();
  const controller = useMemo(() => new LockController(), []);
  const [sessionUnlocked, setSessionUnlocked] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [pinReady, setPinReady] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometrics');
  const backgroundedAt = useRef<number | null>(null);

  const needsLock = settings.lockMode !== 'off';
  /** Fail-closed: lock on + PIN unknown → locked; lock on + PIN known + session locked → locked. */
  const locked = Boolean(ready && needsLock && (!pinReady || (hasPin && !sessionUnlocked)));
  /** Settings ready, and PIN probe finished when lock is on (or lock is off). */
  const authResolved = Boolean(ready && (!needsLock || pinReady));
  const timeoutMs = lockAfterTimeoutMs(settings);

  useEffect(() => {
    let live = true;
    setPinReady(false);
    void controller
      .hasPin()
      .then((exists) => {
        if (!live) {
          return;
        }
        setHasPin(exists);
        setPinReady(true);
      })
      .catch(() => {
        if (!live) {
          return;
        }
        setHasPin(false);
        setPinReady(true);
      });
    void controller.getBiometricCapability().then((cap) => {
      if (!live) {
        return;
      }
      setBiometricAvailable(cap.hardware && cap.enrolled);
      setBiometricLabel(cap.label);
    });
    return () => {
      live = false;
    };
  }, [controller, settings.lockMode]);

  useEffect(() => {
    if (!needsLock) {
      setSessionUnlocked(true);
    }
  }, [needsLock]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt.current = Date.now();
        if (needsLock && timeoutMs === 0) {
          setSessionUnlocked(false);
        }
      }
      if (state === 'active') {
        const started = backgroundedAt.current;
        backgroundedAt.current = null;
        if (needsLock && started !== null && Date.now() - started >= timeoutMs) {
          setSessionUnlocked(false);
        }
      }
    });
    return () => sub.remove();
  }, [needsLock, timeoutMs]);

  const unlockWithPin = useCallback(
    async (pin: string) => {
      try {
        const ok = await controller.verifyPin(pin);
        if (ok) {
          setSessionUnlocked(true);
        }
        return ok;
      } catch {
        return false;
      }
    },
    [controller],
  );

  const unlockWithBiometrics = useCallback(async () => {
    try {
      const ok = await controller.authenticateWithBiometrics();
      if (ok) {
        setSessionUnlocked(true);
      }
      return ok;
    } catch {
      return false;
    }
  }, [controller]);

  const savePin = useCallback(
    async (pin: string) => {
      await controller.savePin(pin);
      setHasPin(true);
      setSessionUnlocked(true);
    },
    [controller],
  );

  const deletePin = useCallback(async () => {
    await controller.deletePin();
    setHasPin(false);
    setSessionUnlocked(true);
  }, [controller]);

  const refreshBiometrics = useCallback(async () => {
    const cap = await controller.getBiometricCapability();
    setBiometricAvailable(cap.hardware && cap.enrolled);
    setBiometricLabel(cap.label);
  }, [controller]);

  const value = useMemo<LockContextValue>(
    () => ({
      locked,
      authResolved,
      biometricAvailable,
      biometricLabel,
      unlockWithPin,
      unlockWithBiometrics,
      savePin,
      verifyPin: (pin) => controller.verifyPin(pin),
      deletePin,
      hasStoredPin: () => controller.hasPin(),
      refreshBiometrics,
    }),
    [
      locked,
      authResolved,
      biometricAvailable,
      biometricLabel,
      unlockWithPin,
      unlockWithBiometrics,
      savePin,
      deletePin,
      refreshBiometrics,
      controller,
    ],
  );

  return (
    <LockContext.Provider value={value}>
      {children}
      <Modal
        visible={locked}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => undefined}
      >
        {locked ? (
          <GestureHandlerRootView style={styles.fill} collapsable={false}>
            <LockScreen
              lockMode={settings.lockMode}
              biometricAvailable={biometricAvailable}
              biometricLabel={biometricLabel}
              onPin={unlockWithPin}
              onBiometrics={unlockWithBiometrics}
            />
          </GestureHandlerRootView>
        ) : null}
      </Modal>
    </LockContext.Provider>
  );
}

/**
 * Purpose: access lock session APIs from views.
 */
export function useLock(): LockContextValue {
  const value = useContext(LockContext);
  if (!value) {
    throw new Error('useLock must be used inside LockProvider.');
  }
  return value;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
