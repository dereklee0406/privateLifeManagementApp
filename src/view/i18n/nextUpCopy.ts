import type { NextUpCard } from '../../model/today/nextUp';
import { formatShortDate } from '../../utils/dateUtils';
import type { Translate } from './I18nProvider';

export type NextUpBadgeIcon = 'alert-circle-outline' | 'time-outline' | 'calendar-outline';

/**
 * Purpose: localize the Next Up due badge (Today / Tomorrow / In N days / date).
 * Inputs: translator, next-up card, Intl locale.
 * Outputs: badge label + contextual icon name.
 * Side effects: none.
 * Design decisions: Model keeps English dueLabel for tests; Home prefers this View string.
 *   Near-future (2–14 days) uses “In N days”; farther dates use a short calendar label.
 */
export function localizeNextUpBadge(
  t: Translate,
  next: NextUpCard,
  intlLocale: string,
): { label: string; icon: NextUpBadgeIcon } {
  switch (next.dueStatus) {
    case 'overdue':
      return { label: t('home.dueOverdue'), icon: 'alert-circle-outline' };
    case 'today':
      return { label: t('date.today'), icon: 'time-outline' };
    case 'tomorrow':
      return { label: t('date.tomorrow'), icon: 'time-outline' };
    case 'future': {
      if (next.days >= 2 && next.days <= 14) {
        return { label: t('home.dueInDays', { count: next.days }), icon: 'time-outline' };
      }
      return {
        label: formatShortDate(next.dueAt.toISOString(), intlLocale),
        icon: 'calendar-outline',
      };
    }
    default:
      return { label: t('date.today'), icon: 'time-outline' };
  }
}
