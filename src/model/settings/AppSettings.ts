export type { LanguagePreference, UiLocale } from './language';
import type { LanguagePreference } from './language';
import type { ExpenseCategoryConfig } from '../finance/expenseCategories';
import { resolveExpenseCategories } from '../finance/expenseCategories';
import type { ConfigurableReminderType } from '../reminders/reminderTypes';
import { resolveReminderTypes } from '../reminders/reminderTypes';

export type ThemePreference = 'system' | 'dark' | 'light';

/**
 * Purpose: user-chosen text size for Halo UI typography.
 * Inputs: You → Appearance · Text size chips.
 * Outputs: persisted on AppSettings; TypographyProvider resolves to a scale factor.
 * Side effects: none.
 * Design decisions: 'system' follows OS Dynamic Type (clamped); presets use fixed multipliers
 *   so layouts stay predictable across devices.
 */
export type FontSizePreference = 'system' | 'small' | 'default' | 'large' | 'extraLarge';

/**
 * Purpose: optional app lock stored as a preference (never the PIN itself).
 * Inputs: You tab lock picker.
 * Outputs: persisted on AppSettings; PIN lives in expo-secure-store.
 * Side effects: none.
 */
export type MoneyCurrency = 'HKD' | 'USD' | 'CNY';
export type LockMode = 'off' | 'pin' | 'biometrics';

/**
 * Purpose: reminder hour wheel labels — stored hour stays 0–23.
 * Inputs: You → Customize clock chips.
 * Outputs: persisted on AppSettings.
 * Side effects: none.
 */
export type ClockHourFormat = '12h' | '24h';

/**
 * Purpose: first weekday on the Calendar month grid and for Today/You “This week”.
 * Inputs: You → Customize · Week starts on.
 * Outputs: persisted on AppSettings.
 * Side effects: none.
 * Design decisions: default Monday — HK-first Halo. Today/You This week was already Mon–Sun.
 *   Calendar used to be Sunday-first via Date.getDay(); both surfaces now share this one field.
 *   Not an ISO-week number; just Sunday vs Monday.
 */
export type WeekStart = 'sunday' | 'monday';

/**
 * Purpose: how long Halo may stay unlocked after she leaves the app.
 * Inputs: You → App lock · Lock after (only when PIN or biometrics is on).
 * Outputs: seconds until the existing session overlay returns: 0 / 60 / 300.
 * Side effects: none.
 * Design decisions: 60s is the previous magic re-lock; Right away is lock-on-blur (0).
 */
export type LockAfterSeconds = 0 | 60 | 300;

/**
 * Purpose: Visa/Mastercard-style foreign-spend markup she picks — not a live network fee.
 * Inputs: You → Money · Card fee when I spend in another currency.
 * Outputs: fraction applied on top of Frankfurter/ECB mid when estimating HKD (0 / 0.015 / 0.02 / 0.03).
 * Side effects: none.
 * Design decisions: four chips only (not a tax engine). 1.5% is the default because HK retail
 *   Visa/MC cards commonly add about 1.5–2% FX + FCY on top of mid-market; None covers 0% FX cards.
 */
export type CardFxFeeRate = 0 | 0.015 | 0.02 | 0.03;

export const CARD_FX_FEE_PRESETS: ReadonlyArray<{ rate: CardFxFeeRate; label: string }> = [
  { rate: 0, label: 'None' },
  { rate: 0.015, label: 'Typical 1.5%' },
  { rate: 0.02, label: 'Typical 2%' },
  { rate: 0.03, label: '3%' },
];

/** HK Visa/Mastercard retail FCY/FX markup is commonly 1.5–2%. Gentler default; she can tap 2% or None. */
export const DEFAULT_CARD_FX_FEE_RATE: CardFxFeeRate = 0.015;

/**
 * Purpose: capture writer preferences that are not journal content.
 * Inputs: constructed by SettingsController.
 * Outputs: JSON-serializable settings record.
 * Side effects: none.
 * Design decisions: onboardingComplete is the only gate for first-run UX; lockMode is not a secret.
 */
export interface AppSettings {
  writerName: string;
  onboardingComplete: boolean;
  themePreference: ThemePreference;
  /**
   * Text size for app typography. Undefined = system (existing installs).
   */
  fontSizePreference?: FontSizePreference;
  dailyPromptEnabled: boolean;
  lockMode: LockMode;
  defaultCurrency: MoneyCurrency;
  /**
   * Card fee on foreign spends when estimating HKD. Undefined = Typical 1.5% (existing installs).
   */
  cardFxFeeRate?: CardFxFeeRate;
  /**
   * Extra Money tools (budgets, assets, loans, income, net picture).
   * Undefined = never chosen: treat as ON only if she already has assets or loans.
   */
  showAdvancedFinance?: boolean;
  /** ISO time of last successful backup export. Never a password or key. */
  lastBackupAt?: string;
  lastBackupJournalCount?: number;
  lastBackupReminderCount?: number;
  lastBackupSpendCount?: number;
  /**
   * Play the phone’s default reminder sound. Undefined = on (existing installs).
   * Web: saved only; OS notifications do not fire.
   */
  reminderSoundEnabled?: boolean;
  /** Tab taps / save / PIN pad haptics. Undefined = on. */
  hapticsEnabled?: boolean;
  /** Reminder hour wheel. Undefined = 24h (existing wheel). */
  clockHourFormat?: ClockHourFormat;
  /**
   * First day on the calendar and what This week means.
   * Undefined = monday (HK-first; matches existing This week Mon–Sun).
   */
  weekStart?: WeekStart;
  /**
   * Seconds in the background before the lock overlay returns.
   * Undefined = 60 (previous ~60s re-lock). 0 = Right away (lock on blur).
   */
  lockAfterSeconds?: LockAfterSeconds;
  /**
   * UI language. Undefined = follow the phone (existing installs).
   * You → Language (not Customize). 中文 stores zh-Hant; zh-Hans is Follow phone only.
   */
  language?: LanguagePreference;
  /**
   * Spend category catalog (You → Money → Expense categories).
   * Undefined = shipping defaults (dining … other, including shopping / entertainment).
   */
  expenseCategories?: ExpenseCategoryConfig[];
  /**
   * Reminder top-level types (You → More → Reminder types).
   * Undefined = shipping defaults (Financial / Health / Household / …).
   * Custom rows store a free-text label; builtins use i18n `types.{id}`.
   */
  reminderTypes?: ConfigurableReminderType[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  writerName: '',
  onboardingComplete: false,
  themePreference: 'system',
  fontSizePreference: 'system',
  dailyPromptEnabled: true,
  lockMode: 'off',
  defaultCurrency: 'HKD',
  cardFxFeeRate: DEFAULT_CARD_FX_FEE_RATE,
  reminderSoundEnabled: true,
  hapticsEnabled: true,
  clockHourFormat: '24h',
  weekStart: 'monday',
  lockAfterSeconds: 60,
  language: 'system',
};

/**
 * Purpose: fixed scale multipliers for non-system font size presets.
 * Inputs: FontSizePreference excluding 'system'.
 * Outputs: scale factor applied by createTypography / TypographyProvider.
 * Side effects: none.
 * Design decisions: Small 0.88 → Extra Large 1.32 keeps neumorphic layouts readable without overflow.
 */
export const FONT_SCALE_FACTORS: Record<Exclude<FontSizePreference, 'system'>, number> = {
  small: 0.88,
  default: 1.0,
  large: 1.16,
  extraLarge: 1.32,
};

/**
 * Purpose: resolve a FontSizePreference (+ optional OS fontScale) into a numeric scale factor.
 * Inputs: preference (missing/'system' = follow OS); systemFontScale from useWindowDimensions().fontScale.
 * Outputs: scale factor used by createTypography and scaleFontSize helpers.
 * Side effects: none (pure).
 * Design decisions: system path clamps OS scale to [0.85, 1.4] so extreme accessibility sizes
 *   do not break tab chrome; presets ignore OS and return FONT_SCALE_FACTORS.
 */
export function resolveFontScale(preference?: FontSizePreference, systemFontScale?: number): number {
  if (!preference || preference === 'system') {
    return Math.min(1.4, Math.max(0.85, systemFontScale ?? 1.0));
  }
  return FONT_SCALE_FACTORS[preference] ?? 1.0;
}

/**
 * Purpose: decide whether Money shows everyday spend/bills or the extra tools.
 * Inputs: persisted settings plus whether assets or loans already exist.
 * Outputs: true when budgets / assets / loans / income / net picture should appear.
 * Side effects: none.
 * Design decisions: new feel is simple (OFF). Existing data with assets or loans keeps extra tools visible until she turns them off.
 */
export function resolveShowAdvancedFinance(
  settings: Pick<AppSettings, 'showAdvancedFinance'>,
  hasAssetsOrLoans: boolean,
): boolean {
  if (typeof settings.showAdvancedFinance === 'boolean') {
    return settings.showAdvancedFinance;
  }
  return hasAssetsOrLoans;
}

/**
 * Purpose: inverse of extra money tools — the default everyday Money tab.
 */
export function simpleMoney(
  settings: Pick<AppSettings, 'showAdvancedFinance'>,
  hasAssetsOrLoans: boolean,
): boolean {
  return !resolveShowAdvancedFinance(settings, hasAssetsOrLoans);
}

/**
 * Purpose: whether reminder OS pings should play the default system sound.
 * Inputs: stored preference (missing = on so older phones keep today’s behavior).
 * Outputs: true = default sound; false = silent banner.
 * Side effects: none.
 * Design decisions: web still persists this; native scheduling reads it in reminderNotifications.native.ts.
 */
export function resolveReminderSoundEnabled(settings: Pick<AppSettings, 'reminderSoundEnabled'>): boolean {
  return settings.reminderSoundEnabled !== false;
}

/**
 * Purpose: whether tab taps, save, and PIN keys may vibrate.
 * Inputs: stored preference (missing = on).
 * Outputs: true when hapticLight / hapticSuccess should fire on native.
 * Side effects: none.
 */
export function resolveHapticsEnabled(settings: Pick<AppSettings, 'hapticsEnabled'>): boolean {
  return settings.hapticsEnabled !== false;
}

/**
 * Purpose: 12-hour vs 24-hour labels on the reminder hour wheel.
 * Inputs: stored preference (missing = 24h).
 * Outputs: clockHourFormat used by HourPicker.
 * Side effects: none.
 * Design decisions: stored hour remains 0–23; only the label changes.
 */
export function resolveClockHourFormat(settings: Pick<AppSettings, 'clockHourFormat'>): ClockHourFormat {
  return settings.clockHourFormat === '12h' ? '12h' : '24h';
}

/**
 * Purpose: Sunday vs Monday as the first calendar / This week day.
 * Inputs: stored preference (missing or junk = monday).
 * Outputs: WeekStart used by weekBounds and the month grid.
 * Side effects: none.
 * Design decisions: Calendar used to start on Sunday via getDay(); product default is Monday
 *   so HK Halo and Today/You This week stay aligned unless she picks Sunday.
 */
export function resolveWeekStart(settings: Pick<AppSettings, 'weekStart'>): WeekStart {
  return settings.weekStart === 'sunday' ? 'sunday' : 'monday';
}

/**
 * Purpose: background seconds before the lock overlay covers the app again.
 * Inputs: stored preference (missing or junk = 60).
 * Outputs: 0 (Right away), 60 (1 minute), or 300 (5 minutes).
 * Side effects: none.
 * Design decisions: 60 matches the previous magic timeout so existing phones keep today’s feel.
 */
export function resolveLockAfterSeconds(settings: Pick<AppSettings, 'lockAfterSeconds'>): LockAfterSeconds {
  if (settings.lockAfterSeconds === 0 || settings.lockAfterSeconds === 300) {
    return settings.lockAfterSeconds;
  }
  return 60;
}

/**
 * Purpose: milliseconds the session overlay waits after she backgrounds Halo.
 * Inputs: stored lock-after preference.
 * Outputs: 0 / 60_000 / 300_000.
 * Side effects: none.
 */
export function lockAfterTimeoutMs(settings: Pick<AppSettings, 'lockAfterSeconds'>): number {
  return resolveLockAfterSeconds(settings) * 1000;
}

/**
 * Purpose: card-fee fraction for HKD estimates (Visa/MC-style markup, not a bank posting).
 * Inputs: stored preference (missing or junk = Typical 1.5%).
 * Outputs: 0 / 0.015 / 0.02 / 0.03.
 * Side effects: none.
 * Design decisions: only the four chips persist; unknown backup values snap to the HK-typical default.
 */
export function resolveCardFxFeeRate(settings: Pick<AppSettings, 'cardFxFeeRate'>): CardFxFeeRate {
  const rate = settings.cardFxFeeRate;
  if (rate === 0 || rate === 0.015 || rate === 0.02 || rate === 0.03) {
    return rate;
  }
  return DEFAULT_CARD_FX_FEE_RATE;
}

/**
 * Purpose: spend category chips for Log a spend / Money (active + soft-hidden catalog).
 * Inputs: AppSettings.expenseCategories (missing = defaults).
 * Outputs: normalized ExpenseCategoryConfig[].
 * Side effects: none.
 */
export function resolveSettingsExpenseCategories(
  settings: Pick<AppSettings, 'expenseCategories'>,
): ExpenseCategoryConfig[] {
  return resolveExpenseCategories(settings);
}

/**
 * Purpose: reminder type chips for list filters / compose Group (active + soft-hidden catalog).
 * Inputs: AppSettings.reminderTypes (missing = defaults).
 * Outputs: normalized ConfigurableReminderType[].
 * Side effects: none.
 */
export function resolveSettingsReminderTypes(
  settings: Pick<AppSettings, 'reminderTypes'>,
): ConfigurableReminderType[] {
  return resolveReminderTypes(settings);
}
