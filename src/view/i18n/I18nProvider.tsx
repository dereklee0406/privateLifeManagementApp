import { createContext, createElement, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { deviceLanguageTag } from '../../data/deviceLocale';
import { useSettings } from '../../controller/SettingsProvider';
import {
  intlLocaleFor,
  resolveLanguagePreference,
  resolveUiLocale,
  type UiLocale,
} from '../../model/settings/language';
import { i18n } from './catalog';

export type Translate = (key: string, options?: Record<string, string | number>) => string;

interface I18nContextValue {
  /** Catalog id: en | zh-Hant | zh-Hans | ja */
  locale: UiLocale;
  /** BCP-47 tag for Intl (zh-Hant-HK, ja-JP, …) */
  intlLocale: string;
  t: Translate;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Purpose: bind You → Language (and Follow phone) to catalogs + Intl.
 * Inputs: AppSettings.language from SettingsProvider.
 * Outputs: t(), locale, intlLocale for views.
 * Side effects: sets i18n-js locale when preference or device tag changes.
 * Design decisions: strings stay in View catalogs; persistence is SettingsController only.
 *   Device tag comes from data/deviceLocale (native expo-localization, web navigator stub).
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const preference = resolveLanguagePreference(settings);
  const locale = resolveUiLocale(preference, deviceLanguageTag());
  const intlLocale = intlLocaleFor(locale);

  i18n.locale = locale;

  const t = useCallback<Translate>(
    (key, options) => i18n.t(key, options),
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, intlLocale, t }),
    [locale, intlLocale, t],
  );

  return createElement(I18nContext.Provider, { value }, children);
}

/**
 * Purpose: read translator + Intl locale from views.
 */
export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error('useI18n must be used inside I18nProvider.');
  }
  return value;
}
