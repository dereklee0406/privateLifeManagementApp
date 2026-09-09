import { I18n } from 'i18n-js';
import { en } from './en';
import { ja } from './ja';
import { zhHans } from './zh-Hans';
import { zhHant } from './zh-Hant';

/**
 * Purpose: shared i18n-js instance for Halo chrome (en / zh-Hant / zh-Hans / ja).
 * Inputs: catalogs in this folder.
 * Outputs: translator used by I18nProvider.
 * Side effects: none until locale is set by the provider.
 * Design decisions: missing keys fall back to English. No network / machine translation.
 */
export const i18n = new I18n({
  en,
  'zh-Hant': zhHant,
  'zh-Hans': zhHans,
  ja,
});

i18n.enableFallback = true;
i18n.defaultLocale = 'en';
i18n.locale = 'en';
