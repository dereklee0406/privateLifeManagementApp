import type { MonthAnchor, Recurrence, RecurrenceType, Weekday } from './Reminder';

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/**
 * Purpose: one compose-form schedule line — recurrence, date, and clock — without stacking pickers.
 * Inputs: Recurrence union and a preformatted time (Customize 12h/24h, including minutes).
 * Outputs: e.g. "Every year · Sep 8 · 2:15 AM" or "Every month · last day · 09:00".
 * Side effects: none.
 * Design decisions: minutes come from the minute wheel and belong on this preview, not a second date field.
 */
export function describeReminderSchedule(recurrence: Recurrence, timeLabel: string): string {
  switch (recurrence.type) {
    case 'daily':
      return `Every day · ${timeLabel}`;
    case 'weekly': {
      const labels = [...new Set(recurrence.weekdays)]
        .sort((left, right) => left - right)
        .map((day) => WEEKDAY_SHORT[day] ?? '');
      return labels.length ? `Every week · ${labels.join(', ')} · ${timeLabel}` : `Every week · ${timeLabel}`;
    }
    case 'monthly':
      return `Every month · ${monthlyDayPhrase(recurrence)} · ${timeLabel}`;
    case 'yearly':
      return `Every year · ${MONTH_SHORT[recurrence.month - 1] ?? ''} ${recurrence.day} · ${timeLabel}`;
    case 'once':
      return `One-time · ${formatOnceDay(recurrence.dayKey)} · ${timeLabel}`;
    case 'every-n-days':
    case 'every-n-weeks':
    case 'every-n-months':
      return `${describeRecurrence(recurrence)} · ${timeLabel}`;
    default:
      return timeLabel;
  }
}

function formatOnceDay(dayKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) {
    return dayKey;
  }
  const month = Number(match[2]);
  const day = Number(match[3]);
  const year = Number(match[1]);
  return `${MONTH_SHORT[month - 1] ?? ''} ${day}, ${year}`;
}

/**
 * Purpose: human recurrence line for list/edit without pulling Intl into every screen.
 * Inputs: Recurrence union.
 * Outputs: short English summary.
 * Side effects: none.
 */
export function describeRecurrence(recurrence: Recurrence): string {
  switch (recurrence.type) {
    case 'daily':
      return 'Every day';
    case 'weekly': {
      const labels = [...new Set(recurrence.weekdays)]
        .sort((left, right) => left - right)
        .map((day) => WEEKDAY_SHORT[day] ?? '');
      return labels.length ? `Weekly · ${labels.join(', ')}` : 'Weekly';
    }
    case 'monthly':
      return `Monthly · ${monthlyDayPhrase(recurrence)}`;
    case 'yearly':
      return `Yearly · ${MONTH_SHORT[recurrence.month - 1] ?? ''} ${recurrence.day}`;
    case 'every-n-days':
      return recurrence.interval === 1 ? 'Every day' : `Every ${recurrence.interval} days`;
    case 'every-n-weeks':
      return `Every ${recurrence.interval} week${recurrence.interval === 1 ? '' : 's'} · ${WEEKDAY_SHORT[recurrence.weekday]}`;
    case 'every-n-months':
      return `Every ${recurrence.interval} month${recurrence.interval === 1 ? '' : 's'} on the ${ordinal(recurrence.dayOfMonth)}`;
    case 'once':
      return `Once · ${recurrence.dayKey}`;
    default:
      return 'Custom';
  }
}

/**
 * Purpose: editor chip labels for recurrence types.
 * Inputs: RecurrenceType.
 * Outputs: short picker label.
 * Side effects: none.
 */
export function recurrenceTypeLabel(type: RecurrenceType): string {
  switch (type) {
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    case 'yearly':
      return 'Yearly';
    case 'every-n-days':
      return 'Every N days';
    case 'every-n-weeks':
      return 'Every N weeks';
    case 'every-n-months':
      return 'Every N months';
    case 'once':
      return 'One-time';
    default:
      return type;
  }
}

/**
 * Purpose: weekday chip letter for S–S pickers.
 * Inputs: Weekday 0–6.
 * Outputs: one or two character label.
 * Side effects: none.
 */
export function weekdayLetter(day: Weekday): string {
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][day] ?? '';
}

function monthlyDayPhrase(recurrence: Extract<Recurrence, { type: 'monthly' }>): string {
  const anchor: MonthAnchor = recurrence.monthAnchor ?? 'date';
  if (anchor === 'end') {
    return 'last day';
  }
  if (anchor === 'start') {
    return 'the 1st';
  }
  return `the ${ordinal(recurrence.dayOfMonth)}`;
}

function ordinal(day: number): string {
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
