/**
 * Purpose: format dates for journal UI without pulling a date library.
 * Inputs: Date or ISO string.
 * Outputs: display strings.
 * Side effects: none.
 * Design decisions: Intl keeps Android/iOS/web wording consistent with the device locale.
 */

/**
 * Purpose: formatted weekday kicker + day/month hero title for the Today home screen.
 * Inputs: Date value and optional locale.
 * Outputs: { weekday: 'Wednesday', title: 'September 9' } or localized equivalent.
 * Side effects: none.
 * Design decisions: Intl formatting provides native capitalization and word order per locale.
 */
export function formatHeaderDate(value: Date, locale?: string): { weekday: string; title: string } {
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(value);
  const title = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric' }).format(value);
  return { weekday, title };
}

/**
 * Purpose: long weekday + date heading for the Today screen.
 */
export function formatLongDate(value: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(value);
}

/**
 * Purpose: compact date for cards and lists.
 */
export function formatShortDate(iso: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

/**
 * Purpose: full calendar day for photo-reel captions (month, day, year).
 * Inputs: ISO timestamp and optional Intl locale.
 * Outputs: localized date such as "Sep 8, 2026".
 * Side effects: none.
 */
export function formatMemoryDate(iso: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

/**
 * Purpose: time of day used for greeting copy.
 */
export function getDayPart(now: Date = new Date()): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = now.getHours();
  if (hour < 5) {
    return 'night';
  }
  if (hour < 12) {
    return 'morning';
  }
  if (hour < 17) {
    return 'afternoon';
  }
  if (hour < 21) {
    return 'evening';
  }
  return 'night';
}

/**
 * Purpose: greeting that matches local time.
 */
export function getGreeting(now: Date = new Date()): string {
  const part = getDayPart(now);
  if (part === 'morning') {
    return 'Good morning';
  }
  if (part === 'afternoon') {
    return 'Good afternoon';
  }
  if (part === 'evening') {
    return 'Good evening';
  }
  return 'Good night';
}

/**
 * Purpose: relative label for a recent entry.
 */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const created = new Date(iso).getTime();
  const deltaMinutes = Math.round((now.getTime() - created) / 60000);
  if (deltaMinutes < 1) {
    return 'Just now';
  }
  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }
  const hours = Math.round(deltaMinutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return formatShortDate(iso);
}

/**
 * Purpose: month heading for the journal timeline.
 */
export function formatMonthHeading(iso: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

/**
 * Purpose: local calendar day key used by search, calendar, and timeline.
 * Inputs: Date.
 * Outputs: YYYY-MM-DD in local time.
 * Side effects: none.
 */
export function toDayKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Purpose: interpret a YYYY-MM-DD key as local noon (stable createdAt for backdated pages).
 * Inputs: day key.
 * Outputs: ISO timestamp.
 * Side effects: none.
 */
export function isoAtLocalNoon(dayKey: string): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0).toISOString();
}

/**
 * Purpose: mm:ss label for voice recordings.
 * Inputs: duration in milliseconds.
 * Outputs: compact clock string.
 * Side effects: none.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Purpose: local clock label for reminder editors (e.g. 9:00 PM or 21:00).
 * Inputs: hour 0–23, minute 0–59, optional hour12 (Customize Clock; omit to follow the device locale).
 * Outputs: time string. Stored hour stays 0–23.
 * Side effects: none.
 */
export function formatTimeOfDay(hour: number, minute: number, hour12?: boolean, locale?: string): string {
  const value = new Date();
  value.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat(locale, {
    hour: hour12 === false ? '2-digit' : 'numeric',
    minute: '2-digit',
    ...(hour12 === undefined ? {} : { hour12 }),
  }).format(value);
}

/**
 * Purpose: next-fire day footnote under the date field (no clock — that lives on the schedule preview).
 * Inputs: fire Date and optional now.
 * Outputs: Today, Tomorrow, or a short weekday + date.
 * Side effects: none.
 */
export function formatNextDay(
  fire: Date,
  now: Date = new Date(),
  locale?: string,
  labels?: { today: string; tomorrow: string },
): string {
  const fireKey = toDayKey(fire);
  if (fireKey === toDayKey(now)) {
    return labels?.today ?? 'Today';
  }
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (fireKey === toDayKey(tomorrow)) {
    return labels?.tomorrow ?? 'Tomorrow';
  }
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(fire);
}

/**
 * Purpose: upcoming-fire label on reminder cards.
 * Inputs: fire Date and optional now.
 * Outputs: Today/Tomorrow or weekday + date, plus time.
 * Side effects: none.
 */
export function formatUpcoming(
  fire: Date,
  now: Date = new Date(),
  locale?: string,
  labels?: { today: string; tomorrow: string },
): string {
  const time = formatTimeOfDay(fire.getHours(), fire.getMinutes(), undefined, locale);
  const fireKey = toDayKey(fire);
  if (fireKey === toDayKey(now)) {
    return `${labels?.today ?? 'Today'} · ${time}`;
  }
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (fireKey === toDayKey(tomorrow)) {
    return `${labels?.tomorrow ?? 'Tomorrow'} · ${time}`;
  }
  const day = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(fire);
  return `${day} · ${time}`;
}
