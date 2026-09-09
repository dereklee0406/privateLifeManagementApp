/**
 * Purpose: reminder kinds share one scheduler with different writer intent.
 * Inputs: chosen in the Reminders editor.
 * Outputs: persisted on each Reminder.
 * Side effects: none.
 * Design decisions: anniversary is a kind (copy + yearly default), not a separate engine.
 */
export type ReminderKind = 'follow-up' | 'goal' | 'reflection' | 'anniversary';

export const REMINDER_KINDS: ReminderKind[] = ['follow-up', 'goal', 'reflection', 'anniversary'];
