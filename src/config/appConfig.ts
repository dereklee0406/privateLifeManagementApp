/**
 * Cross-cutting product configuration for Halo.
 * Purpose: keep brand, storage, and feature flags out of screens.
 * Inputs: none (compile-time constants).
 * Outputs: AppConfig object.
 * Side effects: none.
 * Design decisions: a single config object avoids scattered magic strings.
 */
export const AppConfig = {
  productName: 'Halo',
  tagline: 'Write, remember, and keep track — on this phone',
  /**
   * Splash / adaptive-icon wash. Matches ThemeTokens paper (light #E8E2D6, dark #2C2B28).
   * Raster files in assets/ are still Expo starter marks — replace with a Halo PNG before store.
   */
  brand: {
    splashLight: '#E8E2D6',
    splashDark: '#2C2B28',
  },
  storage: {
    entriesKey: 'halo.journal.entries.v1',
    settingsKey: 'halo.journal.settings.v1',
    remindersKey: 'halo.journal.reminders.v1',
    goalsKey: 'halo.goals.v1',
    financeKey: 'halo.finance.v1',
    fxRatesKey: 'halo.finance.fx.v1',
    trashKey: 'halo.trash.v1',
    pinKey: 'halo.lock.pin',
  },
  lock: {
    /** Default 1-minute background re-lock when AppSettings.lockAfterSeconds is missing. Live timeout is the setting. */
    backgroundTimeoutMs: 60_000,
    pinMinLength: 4,
    pinMaxLength: 6,
  },
  reminders: {
    channelId: 'halo-reminders',
    silentChannelId: 'halo-reminders-silent',
    idPrefix: 'halo.reminder.',
    defaultHour: 21,
    defaultMinute: 0,
  },
  trash: {
    retainDays: 30,
  },
  writing: {
    maxTitleLength: 80,
    maxMoodNoteLength: 80,
    maxBodyLength: 8000,
    maxPhotos: 6,
    maxTags: 8,
  },
  money: {
    currencies: ['HKD', 'USD', 'CNY'] as const,
    defaultCurrency: 'HKD' as const,
    /** Public ECB latest rates. Query is currency codes only — never amounts or identity. */
    fxUrl: 'https://api.frankfurter.app/latest?from=USD&to=HKD,CNY',
  },
  backup: {
    magic: 'HALO1',
    extension: '.halo',
    passwordMinLength: 6,
    kdfIterations: 210_000,
  },
} as const;
