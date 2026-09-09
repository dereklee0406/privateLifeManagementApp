import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SettingsController } from './SettingsController';
import { SettingsLocalStore } from '../data/SettingsLocalStore';
import { setReminderNotificationSound } from '../data/reminderNotifications';
import {
  DEFAULT_SETTINGS,
  resolveHapticsEnabled,
  resolveReminderSoundEnabled,
  type AppSettings,
  type CardFxFeeRate,
  type ClockHourFormat,
  type FontSizePreference,
  type LanguagePreference,
  type LockAfterSeconds,
  type LockMode,
  type MoneyCurrency,
  type ThemePreference,
  type WeekStart,
} from '../model/settings/AppSettings';
import type { ExpenseCategoryConfig } from '../model/finance/expenseCategories';
import type { ConfigurableReminderType } from '../model/reminders/reminderTypes';
import type { BackupStatusMeta } from '../model/backup/backupStatus';
import { setHapticsEnabled } from '../utils/haptics';

interface SettingsContextValue {
  ready: boolean;
  settings: AppSettings;
  completeOnboarding: (writerName: string) => Promise<void>;
  setThemePreference: (theme: ThemePreference) => Promise<void>;
  setFontSizePreference: (size: FontSizePreference) => Promise<void>;
  setDailyPromptEnabled: (enabled: boolean) => Promise<void>;
  renameWriter: (writerName: string) => Promise<void>;
  setLockMode: (mode: LockMode) => Promise<void>;
  setDefaultCurrency: (currency: MoneyCurrency) => Promise<void>;
  setCardFxFeeRate: (rate: CardFxFeeRate) => Promise<void>;
  setShowAdvancedFinance: (enabled: boolean) => Promise<void>;
  setReminderSoundEnabled: (enabled: boolean) => Promise<void>;
  setHapticsEnabled: (enabled: boolean) => Promise<void>;
  setClockHourFormat: (format: ClockHourFormat) => Promise<void>;
  setWeekStart: (weekStart: WeekStart) => Promise<void>;
  setLockAfterSeconds: (seconds: LockAfterSeconds) => Promise<void>;
  setLanguage: (language: LanguagePreference) => Promise<void>;
  setExpenseCategories: (categories: ExpenseCategoryConfig[]) => Promise<void>;
  setReminderTypes: (types: ConfigurableReminderType[]) => Promise<void>;
  recordBackupStatus: (meta: BackupStatusMeta) => Promise<void>;
  reload: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function applyCustomizeRuntime(settings: AppSettings): void {
  setHapticsEnabled(resolveHapticsEnabled(settings));
  setReminderNotificationSound(resolveReminderSoundEnabled(settings));
}

/**
 * Purpose: bind SettingsController to React.
 * Inputs: children tree.
 * Outputs: settings snapshot and mutators.
 * Side effects: loads and writes settings storage; applies haptic/sound flags for native adapters.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const controller = useMemo(() => new SettingsController(new SettingsLocalStore()), []);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    void controller.loadSettings().then((loaded) => {
      applyCustomizeRuntime(loaded);
      setSettings(loaded);
      setReady(true);
    });
  }, [controller]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      ready,
      settings,
      completeOnboarding: async (writerName) => {
        const next = await controller.completeOnboarding(writerName);
        applyCustomizeRuntime(next);
        setSettings(next);
      },
      setThemePreference: async (theme) => {
        setSettings(await controller.setThemePreference(theme));
      },
      setFontSizePreference: async (fontSizePreference) => {
        setSettings(await controller.setFontSizePreference(fontSizePreference));
      },
      setDailyPromptEnabled: async (enabled) => {
        setSettings(await controller.setDailyPromptEnabled(enabled));
      },
      renameWriter: async (writerName) => {
        setSettings(await controller.renameWriter(writerName));
      },
      setLockMode: async (mode) => {
        setSettings(await controller.setLockMode(mode));
      },
      setDefaultCurrency: async (currency) => {
        setSettings(await controller.setDefaultCurrency(currency));
      },
      setCardFxFeeRate: async (rate) => {
        setSettings(await controller.setCardFxFeeRate(rate));
      },
      setShowAdvancedFinance: async (enabled) => {
        setSettings(await controller.setShowAdvancedFinance(enabled));
      },
      setReminderSoundEnabled: async (enabled) => {
        const next = await controller.setReminderSoundEnabled(enabled);
        applyCustomizeRuntime(next);
        setSettings(next);
      },
      setHapticsEnabled: async (enabled) => {
        const next = await controller.setHapticsEnabled(enabled);
        applyCustomizeRuntime(next);
        setSettings(next);
      },
      setClockHourFormat: async (format) => {
        setSettings(await controller.setClockHourFormat(format));
      },
      setWeekStart: async (weekStart) => {
        setSettings(await controller.setWeekStart(weekStart));
      },
      setLockAfterSeconds: async (seconds) => {
        setSettings(await controller.setLockAfterSeconds(seconds));
      },
      setLanguage: async (language) => {
        setSettings(await controller.setLanguage(language));
      },
      setExpenseCategories: async (categories) => {
        setSettings(await controller.setExpenseCategories(categories));
      },
      setReminderTypes: async (types) => {
        setSettings(await controller.setReminderTypes(types));
      },
      recordBackupStatus: async (meta) => {
        setSettings(await controller.recordBackupStatus(meta));
      },
      reload: async () => {
        const next = await controller.loadSettings();
        applyCustomizeRuntime(next);
        setSettings(next);
      },
    }),
    [ready, settings, controller],
  );

  return createElement(SettingsContext.Provider, { value }, children);
}

/**
 * Purpose: access settings use cases from views.
 */
export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) {
    throw new Error('useSettings must be used inside SettingsProvider.');
  }
  return value;
}
