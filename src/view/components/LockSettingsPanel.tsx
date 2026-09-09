import { useEffect, useState } from 'react';
import { Alert, Modal, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useLock } from '../../controller/LockProvider';
import { useSettings } from '../../controller/SettingsProvider';
import { isValidPin } from '../../model/settings/pinRules';
import { resolveLockAfterSeconds, type LockAfterSeconds, type LockMode } from '../../model/settings/AppSettings';
import { useI18n } from '../i18n';
import { Chip } from './Chip';
import { GroupedRow, GroupedSection } from './GroupedList';
import { PinPad } from './PinPad';
import { PrimaryButton } from './PrimaryButton';
import { SheetChrome } from './SheetChrome';
import { TextButton } from './TextButton';
import { useThemeColors } from '../theme/ThemeProvider';
import { type } from '../theme/typography';

const LOCK_AFTER: Array<{ id: LockAfterSeconds; label: string }> = [
  { id: 0, label: 'Right away' },
  { id: 60, label: '1 minute' },
  { id: 300, label: '5 minutes' },
];

/**
 * Purpose: Settings lock controls — Off / PIN / biometrics, Lock after, plus change-PIN / disable confirm.
 * Inputs: settings.lockMode, lockAfterSeconds, and LockProvider.
 * Outputs: iOS grouped section plus PIN setup sheet.
 * Side effects: PIN in platform store; lockMode / lockAfterSeconds in settings JSON only after a PIN exists.
 * Design decisions: lockMode is not written until setup confirms. Lock after is hidden when lock is Off.
 */
export function LockSettingsPanel() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const { settings, setLockMode, setLockAfterSeconds } = useSettings();
  const lock = useLock();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pendingMode, setPendingMode] = useState<Exclude<LockMode, 'off'>>('pin');
  const [mode, setMode] = useState<'idle' | 'setup' | 'confirm' | 'disable' | 'change'>('idle');

  useEffect(() => {
    void lock.refreshBiometrics();
  }, [lock.refreshBiometrics]);

  const finishSetup = async (candidate: string) => {
    if (!isValidPin(candidate)) {
      return;
    }
    if (mode === 'setup') {
      setConfirm(candidate);
      setPin('');
      setMode('confirm');
      return;
    }
    if (mode === 'confirm') {
      if (candidate !== confirm) {
        Alert.alert(t('lock.mismatchTitle'), t('lock.mismatchBody'));
        setPin('');
        setConfirm('');
        setMode('setup');
        return;
      }
      await lock.savePin(candidate);
      await setLockMode(pendingMode);
      setMode('idle');
      setPin('');
      setConfirm('');
    }
    if (mode === 'disable') {
      const ok = await lock.verifyPin(candidate);
      if (!ok) {
        Alert.alert(t('lock.wrongPin'));
        setPin('');
        return;
      }
      await lock.deletePin();
      await setLockMode('off');
      setMode('idle');
      setPin('');
    }
    if (mode === 'change') {
      const ok = await lock.verifyPin(candidate);
      if (!ok) {
        Alert.alert(t('lock.wrongPin'));
        setPin('');
        return;
      }
      setPin('');
      setMode('setup');
    }
  };

  const choose = async (next: LockMode) => {
    if (next === 'off') {
      if (settings.lockMode === 'off') {
        return;
      }
      setMode('disable');
      setPin('');
      return;
    }
    if (next === 'biometrics') {
      await lock.refreshBiometrics();
      if (!lock.biometricAvailable) {
        Alert.alert(t('lock.bioUnavailableTitle'), t('lock.bioUnavailableBody'));
        return;
      }
      const has = await lock.hasStoredPin();
      if (!has) {
        setPendingMode('biometrics');
        setMode('setup');
        setPin('');
        return;
      }
      await setLockMode('biometrics');
      return;
    }
    const has = await lock.hasStoredPin();
    if (!has) {
      setPendingMode('pin');
      setMode('setup');
      setPin('');
      return;
    }
    await setLockMode('pin');
  };

  const pinTitle =
    mode === 'disable'
      ? t('lock.confirmOff')
      : mode === 'change'
        ? t('lock.currentPin')
        : mode === 'confirm'
          ? t('lock.confirmPin')
          : t('lock.choosePin');

  return (
    <>
      <GroupedSection
        header={t('lock.title')}
        icon="lock-closed-outline"
        footer={t('lock.footer')}
      >
        <View style={styles.choiceRow}>
          <View style={styles.chips}>
            {(['off', 'pin', 'biometrics'] as LockMode[]).map((item) => (
              <Chip
                key={item}
                label={item === 'off' ? t('common.off') : item === 'pin' ? t('common.pin') : lock.biometricLabel}
                selected={settings.lockMode === item}
                onPress={() => void choose(item)}
              />
            ))}
          </View>
        </View>
        {settings.lockMode !== 'off' ? (
          <View style={styles.choiceRow}>
            <Text style={[type.headline, styles.choiceTitle, { color: colors.ink, fontWeight: '400' }]}>{t('lock.lockAfter')}</Text>
            <View style={styles.chips}>
              {LOCK_AFTER.map((item) => (
                <Chip
                  key={item.id}
                  label={item.id === 0 ? t('lock.rightAway') : item.id === 60 ? t('lock.oneMinute') : t('lock.fiveMinutes')}
                  selected={resolveLockAfterSeconds(settings) === item.id}
                  onPress={() => void setLockAfterSeconds(item.id)}
                />
              ))}
            </View>
            <Text style={[type.footnote, { color: colors.faint }]}>
              {t('lock.lockAfterHint')}
            </Text>
          </View>
        ) : null}
        {settings.lockMode !== 'off' ? (
          <GroupedRow
            title={t('lock.changePin')}
            onPress={() => {
              setPendingMode(settings.lockMode === 'biometrics' ? 'biometrics' : 'pin');
              setMode('change');
              setPin('');
            }}
            chevron
          />
        ) : null}
      </GroupedSection>
      <Modal visible={mode !== 'idle'} animationType="slide" onRequestClose={() => setMode('idle')}>
        <GestureHandlerRootView style={[styles.modal, { backgroundColor: colors.paper }]}>
          <SheetChrome>
            <View style={styles.sheetInner}>
              <TextButton label={t('common.cancel')} tone="muted" onPress={() => setMode('idle')} />
              <Text style={[type.title2, { color: colors.ink }]}>{pinTitle}</Text>
              <PinPad value={pin} onChange={setPin} onSubmit={(value) => void finishSetup(value)} />
              {pin.length >= 4 ? (
                <PrimaryButton
                  icon="checkmark-circle-outline"
                  label={t('common.continue')}
                  onPress={() => void finishSetup(pin)}
                />
              ) : null}
            </View>
          </SheetChrome>
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  choiceRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    minHeight: 44,
  },
  choiceTitle: {
    fontSize: 17,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
  },
  modal: {
    flex: 1,
  },
  sheetInner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 18,
    justifyContent: 'center',
  },
});
