import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { createBackupController } from '../../controller/BackupController';
import { useFinance } from '../../controller/FinanceProvider';
import { useGoals } from '../../controller/GoalProvider';
import { useJournal } from '../../controller/JournalProvider';
import { useReminders } from '../../controller/ReminderProvider';
import { useSettings } from '../../controller/SettingsProvider';
import { pickBackupFile, shareBackupFile } from '../../data/backupIO';
import { type BackupDocument } from '../../model/backup/BackupDocument';
import { humanErrorKey } from '../../model/errors/humanError';
import { backupPasswordsMatch, isBackupPasswordValid } from '../../model/backup/backupPassword';
import {
  formatBackupWhen,
  readBackupStatus,
  snapshotBackupStatus,
} from '../../model/backup/backupStatus';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface } from '../theme/tokens';
import { GroupedSection } from './GroupedList';
import { PrimaryButton } from './PrimaryButton';
import { TextButton } from './TextButton';

type BackupMode = 'idle' | 'export' | 'import';

/**
 * Purpose: Settings Backup card — export a password-locked file or replace this phone from one.
 * Inputs: journal / reminder / finance / settings refresh after import.
 * Outputs: Export and Import flows with password fields and a replace confirm.
 * Side effects: platform BackupIO (share or download; file picker); store replace on confirmed import.
 * Design decisions: replace-only (no merge); decrypt before confirm so a wrong password never prompts to wipe; PIN is never in the file.
 */
export function BackupPanel() {
  const colors = useThemeColors();
  const { t, intlLocale } = useI18n();
  const controller = useMemo(() => createBackupController(), []);
  const journal = useJournal();
  const reminders = useReminders();
  const finance = useFinance();
  const goals = useGoals();
  const settings = useSettings();
  const backupStatus = readBackupStatus(settings.settings);
  const [mode, setMode] = useState<BackupMode>('idle');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importName, setImportName] = useState('halo-backup.halo');
  const [importBytes, setImportBytes] = useState<Uint8Array | null>(null);

  const reset = () => {
    setMode('idle');
    setPassword('');
    setConfirm('');
    setError(null);
    setImportBytes(null);
    setBusy(false);
  };

  const startImport = async () => {
    setError(null);
    const picked = await pickBackupFile();
    if (!picked) {
      return;
    }
    setImportBytes(picked.bytes);
    setImportName(picked.name);
    setPassword('');
    setMode('import');
  };

  const runExport = async () => {
    if (!isBackupPasswordValid(password)) {
      setError(t('errors.backup.weakPassword'));
      return;
    }
    if (!backupPasswordsMatch(password, confirm)) {
      setError(t('errors.backup.mismatch'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { bytes, filename } = await controller.exportBackup(password, confirm);
      await shareBackupFile(bytes, filename);
      await settings.recordBackupStatus(
        snapshotBackupStatus({
          journalCount: journal.entries.length,
          reminderCount: reminders.reminders.length,
          spendCount: finance.expenses.length,
        }),
      );
      reset();
      Alert.alert(t('backup.savedTitle'), t('backup.savedBody'));
    } catch (caught) {
      setError(t(humanErrorKey(caught, 'backup.saveFailed')));
      setBusy(false);
    }
  };

  const runUnlock = async () => {
    if (!importBytes) {
      return;
    }
    if (!isBackupPasswordValid(password)) {
      setError(t('errors.backup.weakPassword'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const document = await controller.decryptBackup(importBytes, password);
      setBusy(false);
      Alert.alert(
        t('backup.replaceTitle'),
        t('backup.replaceBody'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('backup.replace'),
            style: 'destructive',
            onPress: () => {
              void applyImport(document);
            },
          },
        ],
      );
    } catch (caught) {
      setError(t(humanErrorKey(caught, 'backup.unlockFailed')));
      setBusy(false);
    }
  };

  const applyImport = async (document: BackupDocument) => {
    setBusy(true);
    try {
      await controller.commitBackup(document);
      await Promise.all([
        journal.refresh(),
        reminders.refresh(),
        finance.refresh(),
        goals.refresh(),
        settings.reload(),
      ]);
      reset();
      Alert.alert(t('backup.restoredTitle'), t('backup.restoredBody'));
    } catch (caught) {
      setError(t(humanErrorKey(caught, 'backup.restoreFailed')));
      setBusy(false);
    }
  };

  const runCsv = async () => {
    setBusy(true);
    setError(null);
    try {
      const { bytes, filename } = await controller.exportReadableCsv();
      await shareBackupFile(bytes, filename, 'text/csv');
      setBusy(false);
    } catch (caught) {
      setError(t(humanErrorKey(caught, 'backup.csvFailed')));
      setBusy(false);
    }
  };

  return (
    <GroupedSection
      header={t('backup.title')}
      icon="phone-portrait-outline"
      footer={t('backup.footer')}
    >
      <View style={styles.inner}>
        {backupStatus ? (
          <View style={styles.status}>
            <Text style={[styles.statusWhen, { color: colors.ink }]}>
              {t('backup.lastBackup', { when: formatBackupWhen(backupStatus.lastBackupAt, intlLocale) })}
            </Text>
            <Text style={[styles.statusCounts, { color: colors.muted }]}>
              {t('backup.counts', {
                pages: backupStatus.lastBackupJournalCount,
                reminders: backupStatus.lastBackupReminderCount,
                spends: backupStatus.lastBackupSpendCount,
              })}
            </Text>
          </View>
        ) : (
          <Text style={[styles.statusCounts, { color: colors.faint }]}>{t('backup.noneYet')}</Text>
        )}

        {mode === 'idle' ? (
          <View style={styles.actions}>
            <Text style={[styles.hint, { color: colors.muted }]}>{t('backup.newPhone')}</Text>
            <PrimaryButton icon="share-outline" label={t('backup.export')} onPress={() => { setError(null); setMode('export'); }} />
            <PrimaryButton icon="download-outline" label={t('backup.import')} onPress={() => void startImport()} />
            <TextButton label={t('backup.exportCsv')} tone="muted" onPress={() => void runCsv()} disabled={busy} />
          </View>
        ) : null}

      {mode === 'export' ? (
        <View style={styles.form}>
          <Text style={[styles.fieldLabel, { color: colors.ink }]}>{t('backup.password')}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={t('backup.passwordHint')}
            placeholderTextColor={colors.faint}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            editable={!busy}
            style={[insetSurface(colors, 16), styles.input, { color: colors.ink }]}
          />
          <Text style={[styles.fieldLabel, { color: colors.ink }]}>{t('backup.typeAgain')}</Text>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            placeholder={t('backup.samePassword')}
            placeholderTextColor={colors.faint}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            editable={!busy}
            style={[insetSurface(colors, 16), styles.input, { color: colors.ink }]}
          />
          <Text style={[styles.hint, { color: colors.faint }]}>
            {t('backup.writeDown')}
          </Text>
          <Text style={[styles.hint, { color: colors.faint }]}>
            {t('backup.keepHint')}
          </Text>
          <PrimaryButton
            icon="lock-closed-outline"
            label={busy ? t('backup.locking') : t('backup.saveBackup')}
            disabled={busy}
            onPress={() => void runExport()}
          />
          <TextButton label={t('common.cancel')} tone="muted" onPress={reset} disabled={busy} />
        </View>
      ) : null}

      {mode === 'import' ? (
        <View style={styles.form}>
          <Text style={[styles.hint, { color: colors.muted }]}>{t('backup.restoreHint')}</Text>
          <Text style={[styles.fieldLabel, { color: colors.ink }]}>{t('backup.passwordFor', { name: importName })}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={t('backup.password')}
            placeholderTextColor={colors.faint}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            editable={!busy}
            style={[insetSurface(colors, 16), styles.input, { color: colors.ink }]}
          />
          <PrimaryButton
            icon="checkmark-circle-outline"
            label={busy ? t('backup.unlocking') : t('backup.unlock')}
            disabled={busy}
            onPress={() => void runUnlock()}
          />
          <TextButton label={t('common.cancel')} tone="muted" onPress={reset} disabled={busy} />
        </View>
      ) : null}

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      </View>
    </GroupedSection>
  );
}

const styles = StyleSheet.create({
  inner: {
    padding: 16,
    gap: 12,
  },
  status: {
    gap: 4,
  },
  statusWhen: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    lineHeight: 20,
  },
  statusCounts: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    gap: 10,
  },
  form: {
    gap: 10,
  },
  fieldLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    fontFamily: fonts.body,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 48,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
});
