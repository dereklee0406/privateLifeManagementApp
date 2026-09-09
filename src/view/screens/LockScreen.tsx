import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LockMode } from '../../model/settings/AppSettings';
import { isValidPin } from '../../model/settings/pinRules';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { PinPad } from '../components/PinPad';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, raisedAccent, raisedSurface } from '../theme/tokens';

interface LockScreenProps {
  lockMode: LockMode;
  biometricAvailable: boolean;
  biometricLabel: string;
  onPin: (pin: string) => Promise<boolean>;
  onBiometrics: () => Promise<boolean>;
}

/**
 * Purpose: full-screen gate before tabs when app lock is on.
 * Inputs: lock mode and unlock handlers.
 * Outputs: PIN pad plus optional Face ID / fingerprint.
 * Side effects: one biometric prompt on mount when lockMode is biometrics and hardware is enrolled.
 * Design decisions: PinPad onSubmit plus Unlock so 4–6 digit PINs can finish; onBiometrics is read
 *   from a ref so a new callback identity cannot re-prompt in a loop.
 */
export function LockScreen({
  lockMode,
  biometricAvailable,
  biometricLabel,
  onPin,
  onBiometrics,
}: LockScreenProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const onBiometricsRef = useRef(onBiometrics);
  onBiometricsRef.current = onBiometrics;

  useEffect(() => {
    if (lockMode === 'biometrics' && biometricAvailable) {
      void onBiometricsRef.current();
    }
  }, [lockMode, biometricAvailable]);

  const submit = async (candidate: string) => {
    if (!isValidPin(candidate)) {
      return;
    }
    try {
      const ok = await onPin(candidate);
      if (!ok) {
        setError(t('lock.pinMismatch'));
        setPin('');
      }
    } catch {
      setError(t('lock.pinMismatch'));
      setPin('');
    }
  };

  return (
    <ScreenScaffold>
      <ScrollView
        contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <Text style={[styles.kicker, { color: colors.accent }]}>Halo</Text>
        <Text style={[styles.title, { color: colors.ink }]}>{t('lock.screenTitle')}</Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          {lockMode === 'biometrics' && biometricAvailable
            ? t('lock.screenBio', { label: biometricLabel })
            : t('lock.screenPin')}
        </Text>
        {lockMode === 'biometrics' && biometricAvailable ? (
          <Pressable onPress={() => void onBiometricsRef.current()} style={[raisedSurface(colors, 20), styles.bio]}>
            <Text style={[styles.bioLabel, { color: colors.accent }]}>{t('lock.unlockWith', { label: biometricLabel })}</Text>
          </Pressable>
        ) : null}
        <PinPad
          value={pin}
          onChange={(next) => {
            setError('');
            setPin(next);
          }}
          onSubmit={(value) => void submit(value)}
        />
        {pin.length >= 4 ? (
          <Pressable onPress={() => void submit(pin)} style={[raisedAccent(colors, 20), styles.go]}>
            <Text style={[styles.goLabel, { color: colors.accentInk }]}>{t('lock.unlock')}</Text>
          </Pressable>
        ) : null}
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: 28, gap: 16, justifyContent: 'flex-end' },
  kicker: { fontFamily: fonts.bodySemi, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase' },
  title: { fontFamily: fonts.display, fontSize: 36 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  bio: { paddingVertical: 14, alignItems: 'center' },
  bioLabel: { fontFamily: fonts.bodySemi, fontSize: 15 },
  go: { paddingVertical: 14, alignItems: 'center' },
  goLabel: { fontFamily: fonts.bodySemi, fontSize: 16 },
  error: { fontFamily: fonts.bodyMedium, fontSize: 14, textAlign: 'center' },
});
