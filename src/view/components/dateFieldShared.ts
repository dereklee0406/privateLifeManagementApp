export type DateFieldDisplay = 'date' | 'month' | 'dayOfMonth' | 'monthDay';

export interface DateFieldProps {
  label: string;
  value: Date;
  onChange: (next: Date) => void;
  /** Closed-field wording. The picker is always a calendar date. */
  display?: DateFieldDisplay;
}

/**
 * Purpose: girlfriend-readable label inside the inset well.
 * Inputs: picker Date and display mode.
 * Outputs: locale string (full date, month, day-of-month, or month+day).
 * Side effects: none.
 */
export function formatDateFieldValue(value: Date, display: DateFieldDisplay = 'date', locale?: string): string {
  if (display === 'month') {
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(value);
  }
  if (display === 'dayOfMonth') {
    return new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(value);
  }
  if (display === 'monthDay') {
    return new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric' }).format(value);
  }
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(value);
}
