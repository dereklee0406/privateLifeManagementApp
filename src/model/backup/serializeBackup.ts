import { emptyFinanceDocument, type FinanceDocument } from '../finance/Account';
import { normalizeFinanceDocument } from '../finance/normalizeFinance';
import { normalizeEntries } from '../journal/normalizeEntry';
import type { JournalEntry } from '../journal/JournalEntry';
import { normalizeReminderDocument, type ReminderDocument } from '../reminders/normalizeReminder';
import {
  DEFAULT_SETTINGS,
  resolveCardFxFeeRate,
  resolveClockHourFormat,
  resolveLockAfterSeconds,
  resolveWeekStart,
  type AppSettings,
  type LockMode,
  type MoneyCurrency,
  type ThemePreference,
} from '../settings/AppSettings';
import { AppConfig } from '../../config/appConfig';
import { resolveLanguagePreference } from '../settings/language';
import { resolveExpenseCategories } from '../finance/expenseCategories';
import { resolveReminderTypes } from '../reminders/reminderTypes';
import { BackupError, type BackupDocument } from './BackupDocument';

const THEMES: ThemePreference[] = ['system', 'dark', 'light'];
const LOCK_MODES: LockMode[] = ['off', 'pin', 'biometrics'];
const CURRENCIES: MoneyCurrency[] = [...AppConfig.money.currencies];

/**
 * Purpose: local calendar day for the backup filename (not UTC, so the name matches “today”).
 * Inputs: Date (defaults to now).
 * Outputs: YYYY-MM-DD.
 * Side effects: none.
 */
export function backupDayKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Purpose: suggested export filename.
 * Inputs: Date for the day stamp.
 * Outputs: halo-backup-YYYY-MM-DD.halo
 * Side effects: none.
 * Design decisions: .halo because the bytes are an opaque HALO1 wrapper, not plaintext JSON.
 */
export function backupFilename(now: Date = new Date()): string {
  return `halo-backup-${backupDayKey(now)}${AppConfig.backup.extension}`;
}

/**
 * Purpose: copy settings with an allow-list so PIN / secrets cannot ride along.
 * Inputs: current AppSettings.
 * Outputs: JSON-safe settings (lockMode is a preference, not the PIN).
 * Side effects: none.
 * Design decisions: explicit fields only — extra keys such as pin or secret are dropped.
 */
export function settingsForBackup(settings: AppSettings): AppSettings {
  return {
    writerName: settings.writerName,
    onboardingComplete: settings.onboardingComplete,
    themePreference: settings.themePreference,
    dailyPromptEnabled: settings.dailyPromptEnabled,
    lockMode: settings.lockMode,
    defaultCurrency: settings.defaultCurrency,
    cardFxFeeRate: resolveCardFxFeeRate(settings),
    ...(typeof settings.showAdvancedFinance === 'boolean'
      ? { showAdvancedFinance: settings.showAdvancedFinance }
      : {}),
    reminderSoundEnabled: settings.reminderSoundEnabled !== false,
    hapticsEnabled: settings.hapticsEnabled !== false,
    clockHourFormat: resolveClockHourFormat(settings),
    weekStart: resolveWeekStart(settings),
    lockAfterSeconds: resolveLockAfterSeconds(settings),
    language: resolveLanguagePreference(settings),
    expenseCategories: resolveExpenseCategories(settings),
    reminderTypes: resolveReminderTypes(settings),
    ...(typeof settings.lastBackupAt === 'string' && settings.lastBackupAt
      ? {
          lastBackupAt: settings.lastBackupAt,
          lastBackupJournalCount: settings.lastBackupJournalCount ?? 0,
          lastBackupReminderCount: settings.lastBackupReminderCount ?? 0,
          lastBackupSpendCount: settings.lastBackupSpendCount ?? 0,
        }
      : {}),
  };
}

/**
 * Purpose: assemble a v1 inner document from the four stores.
 * Inputs: journal pages, reminder document, finance document, settings.
 * Outputs: BackupDocument ready to JSON.stringify then encrypt.
 * Side effects: none.
 */
export function buildBackupDocument(input: {
  journal: JournalEntry[];
  reminders: ReminderDocument;
  finance: FinanceDocument;
  settings: AppSettings;
  exportedAt?: string;
}): BackupDocument {
  return {
    version: 1,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    journal: input.journal,
    reminders: {
      reminders: input.reminders.reminders,
      creditCards: input.reminders.creditCards,
    },
    finance: {
      expenses: input.finance.expenses,
      incomes: input.finance.incomes,
      budgets: input.finance.budgets,
      assets: input.finance.assets,
      loans: input.finance.loans,
      recurringSpends: input.finance.recurringSpends ?? [],
    },
    settings: settingsForBackup(input.settings),
  };
}

/**
 * Purpose: stringify the inner document (plaintext only in memory).
 * Inputs: BackupDocument.
 * Outputs: compact JSON string.
 * Side effects: none.
 */
export function serializeBackupDocument(document: BackupDocument): string {
  return JSON.stringify(document);
}

/**
 * Purpose: parse and validate inner JSON; reject unknown garbage.
 * Inputs: decrypted UTF-8 JSON string.
 * Outputs: BackupDocument with normalized rows.
 * Side effects: none.
 * Design decisions: missing top-level keys or wrong types fail the whole import; row-level junk is dropped by existing normalizers.
 */
export function parseBackupDocument(rawJson: string): BackupDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson) as unknown;
  } catch {
    throw new BackupError('corrupt');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BackupError('corrupt');
  }
  const value = parsed as Record<string, unknown>;
  if (value.version !== 1) {
    throw new BackupError('corrupt', 'This backup is not a version Halo can open.');
  }
  if (!('journal' in value) || !('reminders' in value) || !('finance' in value) || !('settings' in value)) {
    throw new BackupError('corrupt');
  }
  if (!Array.isArray(value.journal)) {
    throw new BackupError('corrupt');
  }
  if (value.reminders === null || typeof value.reminders !== 'object') {
    throw new BackupError('corrupt');
  }
  if (!value.finance || typeof value.finance !== 'object' || Array.isArray(value.finance)) {
    throw new BackupError('corrupt');
  }
  if (!value.settings || typeof value.settings !== 'object' || Array.isArray(value.settings)) {
    throw new BackupError('corrupt');
  }

  const journal = normalizeEntries(value.journal);
  if (value.journal.length > 0 && journal.length === 0) {
    throw new BackupError('corrupt');
  }

  const reminders = normalizeReminderDocument(value.reminders);
  const finance = normalizeFinanceDocument(value.finance);
  const settings = parseBackupSettings(value.settings);
  const exportedAt = typeof value.exportedAt === 'string' && value.exportedAt ? value.exportedAt : new Date().toISOString();

  return {
    version: 1,
    exportedAt,
    journal,
    reminders,
    finance: finance ?? emptyFinanceDocument(),
    settings,
  };
}

/**
 * Purpose: hydrate settings from backup JSON using an allow-list (never PIN).
 * Inputs: unknown settings object.
 * Outputs: AppSettings merged with defaults.
 * Side effects: none.
 */
function parseBackupSettings(raw: unknown): AppSettings {
  const value = raw as Record<string, unknown>;
  const themePreference = THEMES.includes(value.themePreference as ThemePreference)
    ? (value.themePreference as ThemePreference)
    : DEFAULT_SETTINGS.themePreference;
  const lockMode = LOCK_MODES.includes(value.lockMode as LockMode)
    ? (value.lockMode as LockMode)
    : DEFAULT_SETTINGS.lockMode;
  const defaultCurrency = CURRENCIES.includes(value.defaultCurrency as MoneyCurrency)
    ? (value.defaultCurrency as MoneyCurrency)
    : DEFAULT_SETTINGS.defaultCurrency;
  return {
    writerName: typeof value.writerName === 'string' ? value.writerName : DEFAULT_SETTINGS.writerName,
    onboardingComplete: value.onboardingComplete === true,
    themePreference,
    dailyPromptEnabled: value.dailyPromptEnabled !== false,
    lockMode,
    defaultCurrency,
    cardFxFeeRate: resolveCardFxFeeRate({
      cardFxFeeRate:
        value.cardFxFeeRate === 0 ||
        value.cardFxFeeRate === 0.015 ||
        value.cardFxFeeRate === 0.02 ||
        value.cardFxFeeRate === 0.03
          ? value.cardFxFeeRate
          : undefined,
    }),
    reminderSoundEnabled: value.reminderSoundEnabled !== false,
    hapticsEnabled: value.hapticsEnabled !== false,
    clockHourFormat: value.clockHourFormat === '12h' ? '12h' : '24h',
    weekStart: value.weekStart === 'sunday' ? 'sunday' : 'monday',
    lockAfterSeconds: resolveLockAfterSeconds({
      lockAfterSeconds:
        value.lockAfterSeconds === 0 || value.lockAfterSeconds === 60 || value.lockAfterSeconds === 300
          ? value.lockAfterSeconds
          : undefined,
    }),
    language: resolveLanguagePreference({
      language: typeof value.language === 'string' ? value.language : undefined,
    }),
    expenseCategories: resolveExpenseCategories({
      expenseCategories: Array.isArray(value.expenseCategories) ? value.expenseCategories : undefined,
    }),
    reminderTypes: resolveReminderTypes({
      reminderTypes: Array.isArray(value.reminderTypes) ? value.reminderTypes : undefined,
    }),
    ...(typeof value.showAdvancedFinance === 'boolean'
      ? { showAdvancedFinance: value.showAdvancedFinance }
      : {}),
    ...(typeof value.lastBackupAt === 'string' && value.lastBackupAt
      ? {
          lastBackupAt: value.lastBackupAt,
          lastBackupJournalCount: backupCount(value.lastBackupJournalCount),
          lastBackupReminderCount: backupCount(value.lastBackupReminderCount),
          lastBackupSpendCount: backupCount(value.lastBackupSpendCount),
        }
      : {}),
  };
}

function backupCount(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
}
