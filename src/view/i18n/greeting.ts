export type GreetingKey =
  | 'home.greetingMorning'
  | 'home.greetingAfternoon'
  | 'home.greetingEvening'
  | 'home.greetingNight';

/**
 * Purpose: pick the Today greeting catalog key from the clock hour.
 * Inputs: local hour in 0–23 (Date#getHours).
 * Outputs: one of the four `home.greeting*` keys.
 * Side effects: none.
 * Design decisions: View-only time-of-day split so catalogs stay the source of copy;
 *   night covers late evening and the small hours (21–4).
 */
export function greetingKeyForHour(hour: number): GreetingKey {
  if (hour >= 5 && hour < 12) {
    return 'home.greetingMorning';
  }
  if (hour >= 12 && hour < 17) {
    return 'home.greetingAfternoon';
  }
  if (hour >= 17 && hour < 21) {
    return 'home.greetingEvening';
  }
  return 'home.greetingNight';
}
