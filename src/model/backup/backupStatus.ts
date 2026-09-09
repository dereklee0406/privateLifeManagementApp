import type { AppSettings } from '../settings/AppSettings';

export interface BackupStatusMeta {
  lastBackupAt: string;
  lastBackupJournalCount: number;
  lastBackupReminderCount: number;
  lastBackupSpendCount: number;
}

/**
 * Purpose: snapshot counts + time after a successful export (metadata only).
 * Inputs: current list lengths and optional instant.
 * Outputs: fields to persist on AppSettings.
 * Side effects: none.
 * Design decisions: never accepts a password, encryption key, or backup file bytes — counts and ISO time only.
 */
export function snapshotBackupStatus(input: {
  journalCount: number;
  reminderCount: number;
  spendCount: number;
  at?: Date;
}): BackupStatusMeta {
  return {
    lastBackupAt: (input.at ?? new Date()).toISOString(),
    lastBackupJournalCount: Math.max(0, Math.floor(input.journalCount)),
    lastBackupReminderCount: Math.max(0, Math.floor(input.reminderCount)),
    lastBackupSpendCount: Math.max(0, Math.floor(input.spendCount)),
  };
}

/**
 * Purpose: read last-export status from settings when she has backed up at least once.
 * Inputs: AppSettings (or a partial).
 * Outputs: meta or null when lastBackupAt is missing.
 * Side effects: none.
 */
export function readBackupStatus(
  settings: Pick<
    AppSettings,
    'lastBackupAt' | 'lastBackupJournalCount' | 'lastBackupReminderCount' | 'lastBackupSpendCount'
  >,
): BackupStatusMeta | null {
  if (typeof settings.lastBackupAt !== 'string' || !settings.lastBackupAt) {
    return null;
  }
  return {
    lastBackupAt: settings.lastBackupAt,
    lastBackupJournalCount: finiteCount(settings.lastBackupJournalCount),
    lastBackupReminderCount: finiteCount(settings.lastBackupReminderCount),
    lastBackupSpendCount: finiteCount(settings.lastBackupSpendCount),
  };
}

/**
 * Purpose: local date/time for You → Backup.
 * Inputs: ISO timestamp.
 * Outputs: locale date + time string.
 * Side effects: none.
 */
export function formatBackupWhen(iso: string, locale?: string): string {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}

/**
 * Purpose: “12 pages · 4 reminders · 28 spends” under last backup time.
 * Inputs: backup status meta.
 * Outputs: one counts line.
 * Side effects: none.
 */
export function formatBackupCounts(meta: BackupStatusMeta): string {
  const pages = `${meta.lastBackupJournalCount} page${meta.lastBackupJournalCount === 1 ? '' : 's'}`;
  const reminders = `${meta.lastBackupReminderCount} reminder${meta.lastBackupReminderCount === 1 ? '' : 's'}`;
  const spends = `${meta.lastBackupSpendCount} spend${meta.lastBackupSpendCount === 1 ? '' : 's'}`;
  return `${pages} · ${reminders} · ${spends}`;
}

function finiteCount(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
