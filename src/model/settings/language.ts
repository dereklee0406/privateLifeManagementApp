/**
 * Purpose: UI language preference and how a phone locale maps onto Halo’s three shipped languages.
 * Inputs: stored AppSettings.language or a BCP-47 tag from expo-localization.
 * Outputs: preference (`system` | `en` | `zh-Hant` | `ja`) and resolved catalog locale (includes zh-Hans).
 * Side effects: none.
 * Design decisions: she cannot pick Simplified in You — 中文 always means Traditional (HK).
 *   zh-Hans is only via Follow phone when the device is mainland/Singapore Chinese.
 *   Mapping lives here (no React, no expo) so backup/settings stay framework-free.
 */

export type LanguagePreference = 'system' | 'en' | 'zh-Hant' | 'ja';

/** Catalogs Halo actually loads. zh-Hans is system-only. */
export type UiLocale = 'en' | 'zh-Hant' | 'zh-Hans' | 'ja';

const PREFERENCES: LanguagePreference[] = ['system', 'en', 'zh-Hant', 'ja'];

/**
 * Purpose: coerce stored language (backup / older installs) to a known preference.
 * Inputs: settings language field (missing or junk = follow the phone).
 * Outputs: LanguagePreference.
 * Side effects: none.
 */
export function resolveLanguagePreference(settings: { language?: string }): LanguagePreference {
  const value = settings.language;
  if (value && PREFERENCES.includes(value as LanguagePreference)) {
    return value as LanguagePreference;
  }
  return 'system';
}

/**
 * Purpose: map a device BCP-47 tag onto a catalog.
 * Inputs: languageTag from getLocales()[0] (e.g. en-HK, zh-Hant-HK, zh-CN, ja-JP).
 * Outputs: UiLocale. Unknown tags → English.
 * Side effects: none.
 * Design decisions:
 *   en* → en
 *   zh-HK / zh-TW / zh-MO / zh-Hant* → zh-Hant
 *   zh-CN / zh-SG / zh-Hans* → zh-Hans
 *   ja* → ja
 *   bare zh (no script/region) → zh-Hans (typical CN Android `zh`)
 */
export function mapDeviceLanguageToUiLocale(languageTag: string): UiLocale {
  const tag = languageTag.trim().replace(/_/g, '-').toLowerCase();
  if (!tag) {
    return 'en';
  }
  if (tag === 'ja' || tag.startsWith('ja-')) {
    return 'ja';
  }
  if (tag === 'en' || tag.startsWith('en-')) {
    return 'en';
  }
  if (tag === 'zh' || tag.startsWith('zh-')) {
    if (
      tag.includes('hant') ||
      tag.includes('-hk') ||
      tag.includes('-tw') ||
      tag.includes('-mo') ||
      tag.endsWith('hk') ||
      tag.endsWith('tw') ||
      tag.endsWith('mo')
    ) {
      return 'zh-Hant';
    }
    return 'zh-Hans';
  }
  return 'en';
}

/**
 * Purpose: pick the catalog from You → Language plus the phone tag.
 * Inputs: stored preference and device languageTag.
 * Outputs: UiLocale used by i18n-js and Intl.
 * Side effects: none.
 */
export function resolveUiLocale(preference: LanguagePreference, deviceLanguageTag: string): UiLocale {
  if (preference === 'system') {
    return mapDeviceLanguageToUiLocale(deviceLanguageTag);
  }
  return preference;
}

/**
 * Purpose: Intl locale so dates read Sep 8 / 9月8日 / 9月8日, not the OS default when she overrode language.
 * Inputs: resolved UiLocale.
 * Outputs: BCP-47 tag for DateTimeFormat (HK Traditional, JP, US English, CN Simplified).
 * Side effects: none.
 */
export function intlLocaleFor(ui: UiLocale): string {
  if (ui === 'zh-Hant') {
    return 'zh-Hant-HK';
  }
  if (ui === 'zh-Hans') {
    return 'zh-Hans-CN';
  }
  if (ui === 'ja') {
    return 'ja-JP';
  }
  return 'en';
}
