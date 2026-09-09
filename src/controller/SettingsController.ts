import { DEFAULT_SETTINGS, resolveCardFxFeeRate, type AppSettings, type CardFxFeeRate, type ClockHourFormat, type FontSizePreference, type LanguagePreference, type LockAfterSeconds, type LockMode, type MoneyCurrency, type ThemePreference, type WeekStart } from '../model/settings/AppSettings';
import { resolveExpenseCategories, type ExpenseCategoryConfig } from '../model/finance/expenseCategories';
import {
  resolveReminderTypes,
  type ConfigurableReminderType,
} from '../model/reminders/reminderTypes';
import { resolveLanguagePreference } from '../model/settings/language';
import type { SettingsRepository } from '../model/settings/SettingsRepository';
import type { BackupStatusMeta } from '../model/backup/backupStatus';

/**
 * Purpose: orchestrate onboarding and preference updates.
 * Inputs: SettingsRepository plus writer actions.
 * Outputs: AppSettings snapshots.
 * Side effects: persistence through the repository.
 * Design decisions: merge with defaults so older stored documents remain readable.
 */
export class SettingsController {
  constructor(private readonly repository: SettingsRepository) {}

  async loadSettings(): Promise<AppSettings> {
    const stored = await this.repository.load();
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  async completeOnboarding(writerName: string): Promise<AppSettings> {
    const current = await this.loadSettings();
    const next: AppSettings = {
      ...current,
      writerName: writerName.trim() || 'Writer',
      onboardingComplete: true,
    };
    await this.repository.save(next);
    return next;
  }

  async setThemePreference(themePreference: ThemePreference): Promise<AppSettings> {
    const current = await this.loadSettings();
    const next = { ...current, themePreference };
    await this.repository.save(next);
    return next;
  }

  /**
   * Purpose: persist You → Appearance · Text size preference.
   * Inputs: system | small | default | large | extraLarge.
   * Outputs: updated AppSettings.
   * Side effects: settings JSON write. TypographyProvider re-reads via SettingsProvider.
   * Design decisions: scale resolution stays in Model (resolveFontScale); controller only persists.
   */
  async setFontSizePreference(fontSizePreference: FontSizePreference): Promise<AppSettings> {
    const current = await this.loadSettings();
    const next = { ...current, fontSizePreference };
    await this.repository.save(next);
    return next;
  }

  async setDailyPromptEnabled(dailyPromptEnabled: boolean): Promise<AppSettings> {
    const current = await this.loadSettings();
    const next = { ...current, dailyPromptEnabled };
    await this.repository.save(next);
    return next;
  }

  async renameWriter(writerName: string): Promise<AppSettings> {
    const current = await this.loadSettings();
    const next = { ...current, writerName: writerName.trim() || current.writerName };
    await this.repository.save(next);
    return next;
  }

  /**
   * Purpose: persist lock mode only (PIN stays in secure-store via LockController).
   * Inputs: off | pin | biometrics.
   * Outputs: updated AppSettings.
   * Side effects: settings JSON write.
   */
  async setLockMode(lockMode: LockMode): Promise<AppSettings> {
    const current = await this.loadSettings();
    const next = { ...current, lockMode };
    await this.repository.save(next);
    return next;
  }

  /**
   * Purpose: default currency for new expenses (HKD for Hong Kong).
   */
  async setDefaultCurrency(defaultCurrency: MoneyCurrency): Promise<AppSettings> {
    const current = await this.loadSettings();
    const next = { ...current, defaultCurrency };
    await this.repository.save(next);
    return next;
  }

  /**
   * Purpose: persist the card-fee chip for estimated HKD on foreign spends.
   * Inputs: None / Typical 1.5% / Typical 2% / 3% as a fraction.
   * Outputs: updated AppSettings.
   * Side effects: settings JSON write. Conversion math stays in Model; saved spends keep their snapshot.
   */
  async setCardFxFeeRate(cardFxFeeRate: CardFxFeeRate): Promise<AppSettings> {
    const current = await this.loadSettings();
    const next = { ...current, cardFxFeeRate: resolveCardFxFeeRate({ cardFxFeeRate }) };
    await this.repository.save(next);
    return next;
  }

  /**
   * Purpose: persist whether extra Money tools stay visible.
   * Inputs: true = budgets, assets, loans, income, net picture; false = everyday spend + bills.
   * Outputs: updated AppSettings.
   * Side effects: settings JSON write.
   */
  async setShowAdvancedFinance(showAdvancedFinance: boolean): Promise<AppSettings> {
    const current = await this.loadSettings();
    const next = { ...current, showAdvancedFinance };
    await this.repository.save(next);
    return next;
  }

  /**
   * Purpose: persist reminder ping sound vs silent.
   * Inputs: true = default system sound; false = silent banner (native still shows the ping).
   * Outputs: updated AppSettings.
   * Side effects: settings JSON write. Native reschedule is the ReminderController’s job.
   */
  async setReminderSoundEnabled(reminderSoundEnabled: boolean): Promise<AppSettings> {
    const current = await this.loadSettings();
    const next = { ...current, reminderSoundEnabled };
    await this.repository.save(next);
    return next;
  }

  /**
   * Purpose: persist tab/save/PIN haptics on or off.
   */
  async setHapticsEnabled(hapticsEnabled: boolean): Promise<AppSettings> {
    const current = await this.loadSettings();
    const next = { ...current, hapticsEnabled };
    await this.repository.save(next);
    return next;
  }

  /**
   * Purpose: persist 12-hour vs 24-hour labels on the reminder hour wheel.
   */
  async setClockHourFormat(clockHourFormat: ClockHourFormat): Promise<AppSettings> {
    const current = await this.loadSettings();
    const next = { ...current, clockHourFormat };
    await this.repository.save(next);
    return next;
  }

  /**
   * Purpose: persist first weekday for the Calendar grid and Today/You This week.
   * Inputs: sunday | monday.
   * Outputs: updated AppSettings.
   * Side effects: settings JSON write. Views re-read weekStart; no reschedule needed.
   * Design decisions: one field for Calendar and This week — no ISO week numbers.
   */
  async setWeekStart(weekStart: WeekStart): Promise<AppSettings> {
    const current = await this.loadSettings();
    const next = { ...current, weekStart };
    await this.repository.save(next);
    return next;
  }

  /**
   * Purpose: persist how soon the lock overlay returns after she leaves.
   * Inputs: 0 (Right away), 60 (1 minute), or 300 (5 minutes).
   * Outputs: updated AppSettings.
   * Side effects: settings JSON write. LockSessionProvider reads this as the background timeout.
   * Design decisions: same overlay as before; only the wait changes (0 / 60 / 300).
   */
  async setLockAfterSeconds(lockAfterSeconds: LockAfterSeconds): Promise<AppSettings> {
    const current = await this.loadSettings();
    const next = { ...current, lockAfterSeconds };
    await this.repository.save(next);
    return next;
  }

  /**
   * Purpose: persist You → Language (Follow phone / English / 中文 / 日本語).
   * Inputs: system | en | zh-Hant | ja.
   * Outputs: updated AppSettings.
   * Side effects: settings JSON write. Catalogs live in View; this only stores the preference.
   */
  async setLanguage(language: LanguagePreference): Promise<AppSettings> {
    const current = await this.loadSettings();
    const next = { ...current, language: resolveLanguagePreference({ language }) };
    await this.repository.save(next);
    return next;
  }

  /**
   * Purpose: persist the spend category catalog (You → Money → Expense categories).
   * Inputs: full ordered list (active + soft-hidden).
   * Outputs: updated AppSettings with normalized categories.
   * Side effects: settings JSON write. Log a spend / Money re-read via SettingsProvider.
   * Design decisions: normalize here so backup junk cannot drop `other` or break icons.
   */
  async setExpenseCategories(expenseCategories: ExpenseCategoryConfig[]): Promise<AppSettings> {
    const current = await this.loadSettings();
    const next = {
      ...current,
      expenseCategories: resolveExpenseCategories({ expenseCategories }),
    };
    await this.repository.save(next);
    return next;
  }

  /**
   * Purpose: persist the reminder-types catalog (You → Reminder types).
   * Inputs: full ordered list (active + soft-hidden).
   * Outputs: updated AppSettings with normalized types.
   * Side effects: settings JSON write. Reminder list / compose re-read via SettingsProvider.
   * Design decisions: normalize here so backup junk cannot drop `other` or break icons.
   */
  async setReminderTypes(reminderTypes: ConfigurableReminderType[]): Promise<AppSettings> {
    const current = await this.loadSettings();
    const next = {
      ...current,
      reminderTypes: resolveReminderTypes({ reminderTypes }),
    };
    await this.repository.save(next);
    return next;
  }

  /**
   * Purpose: persist last-export metadata only (time + counts). Never a password or key.
   * Inputs: snapshot from snapshotBackupStatus after a successful share/download.
   * Outputs: updated AppSettings.
   * Side effects: settings JSON write.
   */
  async recordBackupStatus(meta: BackupStatusMeta): Promise<AppSettings> {
    const current = await this.loadSettings();
    const next: AppSettings = {
      ...current,
      lastBackupAt: meta.lastBackupAt,
      lastBackupJournalCount: meta.lastBackupJournalCount,
      lastBackupReminderCount: meta.lastBackupReminderCount,
      lastBackupSpendCount: meta.lastBackupSpendCount,
    };
    await this.repository.save(next);
    return next;
  }
}
