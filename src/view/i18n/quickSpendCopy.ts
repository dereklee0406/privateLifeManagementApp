import type { QuickAddTemplate } from '../../model/finance/quickAdd';
import type { Translate } from './I18nProvider';

/** Template id → i18n label key (Model keeps stable English ids; View localizes). */
const TEMPLATE_LABEL_KEYS: Record<string, string> = {
  'morning-coffee': 'spend.templateMorningCoffee',
  lunch: 'spend.templateLunch',
  'mtr-ride': 'spend.templateMTR',
};

/**
 * Purpose: localized display label for a one-tap quick-add template.
 * Inputs: t translator, template from Model quickAddTemplates.
 * Outputs: localized label; falls back to the Model's English label for unknown ids.
 * Side effects: none.
 * Design decisions: ids stay stable English in Model so usage stats can key off them later;
 *   the id → copy mapping lives in View i18n next to the catalogs, shared by QuickSpendSheet,
 *   InlineHomeQuickAdd, and the ExpenseEditScreen Quick Spend mode.
 */
export function localizeQuickAddTemplateLabel(t: Translate, template: QuickAddTemplate): string {
  const key = TEMPLATE_LABEL_KEYS[template.id];
  return key ? t(key) : template.label;
}
