import type { Translate } from './I18nProvider';

/**
 * Purpose: girlfriend-simple due line for a Goal target date.
 * Inputs: t() and signed whole days until the target (from daysUntilTarget).
 * Outputs: localized string.
 * Side effects: none.
 */
export function localizeGoalDue(t: Translate, days: number): string {
  if (days === 0) {
    return t('goals.dueToday');
  }
  if (days === 1) {
    return t('goals.dueInOne');
  }
  if (days > 1) {
    return t('goals.dueIn', { count: days });
  }
  if (days === -1) {
    return t('goals.overdueOne');
  }
  return t('goals.overdue', { count: Math.abs(days) });
}
