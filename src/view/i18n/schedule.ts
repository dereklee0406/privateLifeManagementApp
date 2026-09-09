import type { Recurrence, Weekday } from '../../model/reminders/Reminder';
import type { Translate } from './I18nProvider';

/**
 * Purpose: girlfriend-simple reminder preview line in the active UI language.
 * Inputs: recurrence, already-localized clock label, t(), Intl locale.
 * Outputs: e.g. Every year · Sep 8 · 2:15 AM / 每年 · 9月8日 · 上午2:15
 * Side effects: none.
 * Design decisions: dates go through Intl; “last day” / “the 1st” / “the 8th” are catalog keys.
 *   English ordinals stay in this View helper so Model stay language-light.
 */
export function formatReminderSchedule(
  recurrence: Recurrence,
  timeLabel: string,
  t: Translate,
  intlLocale: string,
): string {
  switch (recurrence.type) {
    case 'daily':
      return t('reminder.previewDaily', { time: timeLabel });
    case 'weekly': {
      const days = weekdayList(recurrence.weekdays, intlLocale);
      return days
        ? t('reminder.previewWeekly', { days, time: timeLabel })
        : t('reminder.previewWeeklyBare', { time: timeLabel });
    }
    case 'monthly':
      return t('reminder.previewMonthly', {
        day: monthlyDayPhrase(recurrence, t, intlLocale),
        time: timeLabel,
      });
    case 'yearly':
      return t('reminder.previewYearly', {
        date: formatMonthDay(recurrence.month, recurrence.day, intlLocale),
        time: timeLabel,
      });
    case 'once':
      return t('reminder.previewOnce', {
        date: formatDayKey(recurrence.dayKey, intlLocale),
        time: timeLabel,
      });
    default:
      return timeLabel;
  }
}

function monthlyDayPhrase(
  recurrence: Extract<Recurrence, { type: 'monthly' }>,
  t: Translate,
  intlLocale: string,
): string {
  const anchor = recurrence.monthAnchor ?? 'date';
  if (anchor === 'end') {
    return t('reminder.lastDay');
  }
  if (anchor === 'start') {
    return t('reminder.theFirst');
  }
  if (intlLocale.startsWith('en')) {
    return t('reminder.theNth', { day: englishOrdinal(recurrence.dayOfMonth) });
  }
  return t('reminder.theNth', { day: recurrence.dayOfMonth });
}

function formatMonthDay(month: number, day: number, intlLocale: string): string {
  const value = new Date(2026, Math.max(0, month - 1), Math.max(1, day));
  return new Intl.DateTimeFormat(intlLocale, { month: 'short', day: 'numeric' }).format(value);
}

function formatDayKey(dayKey: string, intlLocale: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) {
    return dayKey;
  }
  const value = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat(intlLocale, { month: 'short', day: 'numeric', year: 'numeric' }).format(value);
}

function weekdayList(weekdays: Weekday[], intlLocale: string): string {
  return [...new Set(weekdays)]
    .sort((left, right) => left - right)
    .map((day) => weekdayShort(day, intlLocale))
    .join(', ');
}

/**
 * Purpose: weekday chip / preview label in the active locale (日一二… or S M T…).
 */
export function weekdayShort(day: Weekday, intlLocale: string): string {
  const sunday = new Date(2026, 8, 6);
  const value = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + day);
  return new Intl.DateTimeFormat(intlLocale, { weekday: 'short' }).format(value);
}

function englishOrdinal(day: number): string {
  const remainder = day % 10;
  const tens = day % 100;
  if (remainder === 1 && tens !== 11) {
    return `${day}st`;
  }
  if (remainder === 2 && tens !== 12) {
    return `${day}nd`;
  }
  if (remainder === 3 && tens !== 13) {
    return `${day}rd`;
  }
  return `${day}th`;
}
