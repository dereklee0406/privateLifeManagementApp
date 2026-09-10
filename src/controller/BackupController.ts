import type { FinanceRepository } from '../model/finance/FinanceRepository';
import type { JournalRepository } from '../model/journal/JournalRepository';
import type { ReminderRepository } from '../model/reminders/ReminderRepository';
import type { SettingsRepository } from '../model/settings/SettingsRepository';
import { DEFAULT_SETTINGS, resolveReminderSoundEnabled } from '../model/settings/AppSettings';
import { decryptBackupPayload, encryptBackupPayload } from '../model/backup/backupCrypto';
import { asBackupError, BackupError, type BackupDocument } from '../model/backup/BackupDocument';
import { backupPasswordsMatch, isBackupPasswordValid } from '../model/backup/backupPassword';
import {
  backupFilename,
  buildBackupDocument,
  parseBackupDocument,
  serializeBackupDocument,
} from '../model/backup/serializeBackup';
import { buildReadableCsv, readableCsvFilename } from '../model/backup/readableExport';
import { JournalLocalStore } from '../data/JournalLocalStore';
import { FinanceLocalStore } from '../data/FinanceLocalStore';
import { RemindersLocalStore } from '../data/RemindersLocalStore';
import { SettingsLocalStore } from '../data/SettingsLocalStore';
import { ensureCsprng } from '../data/ensureCsprng';
import { hasPin } from '../data/pinStore';
import { lockModeAfterRestore } from '../model/settings/pinRules';
import { ReminderController } from './ReminderController';

/**
 * Purpose: orchestrate encrypted backup export/import without UI.
 * Inputs: the four repositories plus reminder scheduler for native notification refill.
 * Outputs: encrypted file bytes + filename; import writes stores then reschedules pings.
 * Side effects: AsyncStorage replace-all on import; OS notification sync on native.
 * Design decisions: decrypt + validate fully before any write; PIN never loaded from secure-store.
 */
export class BackupController {
  constructor(
    private readonly journal: JournalRepository,
    private readonly reminders: ReminderRepository,
    private readonly finance: FinanceRepository,
    private readonly settings: SettingsRepository,
    private readonly reminderScheduler: Pick<ReminderController, 'syncSchedules'>,
  ) {}

  /**
   * Purpose: snapshot all on-device life+money and encrypt with her backup password.
   * Inputs: password (min 6); optional confirm that must match when provided.
   * Outputs: opaque HALO1 bytes and halo-backup-YYYY-MM-DD.halo filename.
   * Side effects: none (read-only stores).
   */
  async exportBackup(password: string, confirm?: string): Promise<{ bytes: Uint8Array; filename: string }> {
    ensureCsprng();
    if (confirm !== undefined && !backupPasswordsMatch(password, confirm)) {
      throw new BackupError('mismatch');
    }
    if (!isBackupPasswordValid(password)) {
      throw new BackupError('weak-password');
    }
    const [journal, reminders, finance, storedSettings] = await Promise.all([
      this.journal.loadAll(),
      this.reminders.load(),
      this.finance.load(),
      this.settings.load(),
    ]);
    const document = buildBackupDocument({
      journal,
      reminders,
      finance,
      settings: storedSettings ?? DEFAULT_SETTINGS,
    });
    const bytes = await encryptBackupPayload(serializeBackupDocument(document), password);
    return { bytes, filename: backupFilename() };
  }

  /**
   * Purpose: readable CSV of page titles and spends (not encrypted; still on-device share).
   * Inputs: none (reads journal + finance).
   * Outputs: UTF-8 CSV bytes and halo-export-YYYY-MM-DD.csv filename.
   * Side effects: none.
   */
  async exportReadableCsv(): Promise<{ bytes: Uint8Array; filename: string }> {
    const [journal, finance] = await Promise.all([this.journal.loadAll(), this.finance.load()]);
    const text = buildReadableCsv(journal, finance.expenses);
    return { bytes: new TextEncoder().encode(text), filename: readableCsvFilename() };
  }

  /**
   * Purpose: decrypt and validate a file without writing stores.
   * Inputs: file bytes and password.
   * Outputs: inner BackupDocument when the password and shape are good.
   * Side effects: none.
   */
  async decryptBackup(fileBytes: Uint8Array, password: string): Promise<BackupDocument> {
    ensureCsprng();
    let plaintext: string;
    try {
      plaintext = await decryptBackupPayload(fileBytes, password);
    } catch (error) {
      throw asBackupError(error);
    }
    return parseBackupDocument(plaintext);
  }

  /**
   * Purpose: replace all local stores with a validated backup document.
   * Inputs: BackupDocument from decryptBackup.
   * Outputs: void.
   * Side effects: replace journal, reminders, finance, settings JSON; reschedule reminder notifications; never touches secure-store PIN.
   *   If the backup had lock on but this device has no PIN, lockMode is saved as off so she is not trapped.
   */
  async commitBackup(document: BackupDocument): Promise<void> {
    const pinExists = await hasPin();
    const settings = {
      ...document.settings,
      lockMode: lockModeAfterRestore(document.settings.lockMode, pinExists),
    };
    await this.journal.saveAll(document.journal);
    await this.reminders.save(document.reminders);
    await this.finance.save(document.finance);
    await this.settings.save(settings);
    await this.reminderScheduler.syncSchedules({
      playSound: resolveReminderSoundEnabled(settings),
      redactLockScreen: settings.lockMode !== 'off',
      permissionTrigger: 'restore',
    });
  }

  /**
   * Purpose: decrypt, validate, then replace on-device stores with the backup.
   * Inputs: file bytes and password.
   * Outputs: void on success.
   * Side effects: same as commitBackup; no writes if decrypt/validate fails.
   */
  async importBackup(fileBytes: Uint8Array, password: string): Promise<void> {
    const document = await this.decryptBackup(fileBytes, password);
    await this.commitBackup(document);
  }
}

/**
 * Purpose: wire BackupController to the same local stores the rest of Halo uses.
 * Inputs: none.
 * Outputs: BackupController instance.
 * Side effects: none until export/import is called.
 */
export function createBackupController(): BackupController {
  const reminderStore = new RemindersLocalStore();
  return new BackupController(
    new JournalLocalStore(),
    reminderStore,
    new FinanceLocalStore(),
    new SettingsLocalStore(),
    new ReminderController(reminderStore),
  );
}
