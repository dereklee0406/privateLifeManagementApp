import type { Recurrence, ReminderDraft, ReminderKind, ReminderPriority } from './Reminder';
import { categoryPathForTemplate } from './categories';

/**
 * Purpose: stable ids for smart reminder templates (persisted on Reminder.templateId).
 * Inputs: catalog + editor picker.
 * Outputs: string union stored in JSON.
 * Side effects: none.
 */
export type ReminderTemplateId =
  | 'plain'
  | 'credit-card'
  | 'loan'
  | 'health'
  | 'vehicle'
  | 'certification'
  | 'subscription'
  | 'goal'
  | 'follow-up'
  | 'anniversary'
  | 'family'
  | 'household';

/**
 * Purpose: catalog entry the View can list without embedding business defaults.
 * Inputs: static REMINDER_TEMPLATES.
 * Outputs: copy, kind, and a recurrence factory (yearly/monthly need “today”).
 * Side effects: none.
 */
export interface ReminderTemplate {
  id: ReminderTemplateId;
  emoji: string;
  label: string;
  kind: ReminderKind;
  title: string;
  note: string;
  hour: number;
  minute: number;
  priority: ReminderPriority;
  recurrenceFor: (now: Date) => Recurrence;
}

const DEFAULT_HOUR = 21;
const DEFAULT_MINUTE = 0;

/**
 * Purpose: monthly bill-style recurrence anchored to today’s civil day (clamped later by next-fire).
 */
function monthlyOnToday(now: Date): Recurrence {
  return { type: 'monthly', dayOfMonth: now.getDate() };
}

/**
 * Purpose: yearly date matching today (anniversary / certification).
 */
function yearlyOnToday(now: Date): Recurrence {
  return { type: 'yearly', month: now.getMonth() + 1, day: now.getDate() };
}

/**
 * Purpose: Halo smart-template catalog. Plain Text is a blank custom reminder.
 * Inputs: none (compile-time data).
 * Outputs: ordered list for the create-flow picker (View maps id → Ionicons; emoji is unused in UI).
 * Side effects: none.
 * Design decisions: lives in Model so Controller.applyTemplate is data-driven; View only renders.
 */
export const REMINDER_TEMPLATES: ReminderTemplate[] = [
  {
    id: 'plain',
    emoji: '✏️',
    label: 'Something else',
    kind: 'reflection',
    title: '',
    note: '',
    hour: DEFAULT_HOUR,
    minute: DEFAULT_MINUTE,
    priority: 'normal',
    recurrenceFor: () => ({ type: 'daily' }),
  },
  {
    id: 'credit-card',
    emoji: '💳',
    label: 'Card bill',
    kind: 'follow-up',
    title: 'Credit card payment',
    note: 'Check the statement and pay what you owe.',
    hour: 10,
    minute: 0,
    priority: 'high',
    recurrenceFor: monthlyOnToday,
  },
  {
    id: 'loan',
    emoji: '🏦',
    label: 'Loan',
    kind: 'follow-up',
    title: 'Loan payment',
    note: 'A nudge for the installment due this cycle.',
    hour: 10,
    minute: 0,
    priority: 'high',
    recurrenceFor: monthlyOnToday,
  },
  {
    id: 'health',
    emoji: '🏥',
    label: 'Health',
    kind: 'reflection',
    title: 'Health check-in',
    note: 'How is your body today? Any appointments to keep?',
    hour: 20,
    minute: 0,
    priority: 'normal',
    recurrenceFor: () => ({ type: 'weekly', weekdays: [0] }),
  },
  {
    id: 'vehicle',
    emoji: '🚗',
    label: 'Vehicle',
    kind: 'follow-up',
    title: 'Vehicle check',
    note: 'Insurance, service, or a quick look at the car.',
    hour: 10,
    minute: 0,
    priority: 'high',
    recurrenceFor: monthlyOnToday,
  },
  {
    id: 'certification',
    emoji: '📚',
    label: 'Certification',
    kind: 'anniversary',
    title: 'Certification renewal',
    note: 'Review expiry dates and study or renew.',
    hour: DEFAULT_HOUR,
    minute: DEFAULT_MINUTE,
    priority: 'normal',
    recurrenceFor: yearlyOnToday,
  },
  {
    id: 'subscription',
    emoji: '💻',
    label: 'Subscription',
    kind: 'follow-up',
    title: 'Subscription renewal',
    note: 'Decide whether this still earns its place.',
    hour: 10,
    minute: 0,
    priority: 'high',
    recurrenceFor: monthlyOnToday,
  },
  {
    id: 'goal',
    emoji: '🎯',
    label: 'Goal',
    kind: 'goal',
    title: 'Goal check-in',
    note: 'A small look at the promise you named.',
    hour: DEFAULT_HOUR,
    minute: DEFAULT_MINUTE,
    priority: 'normal',
    recurrenceFor: () => ({ type: 'weekly', weekdays: [1] }),
  },
  {
    id: 'follow-up',
    emoji: '📝',
    label: 'Follow up',
    kind: 'follow-up',
    title: 'Continue this',
    note: 'Write or record today',
    hour: DEFAULT_HOUR,
    minute: DEFAULT_MINUTE,
    priority: 'normal',
    recurrenceFor: () => ({ type: 'every-n-days', interval: 3 }),
  },
  {
    id: 'anniversary',
    emoji: '🎉',
    label: 'Anniversary',
    kind: 'anniversary',
    title: 'Anniversary',
    note: 'A date worth a page.',
    hour: DEFAULT_HOUR,
    minute: DEFAULT_MINUTE,
    priority: 'normal',
    recurrenceFor: yearlyOnToday,
  },
  {
    id: 'family',
    emoji: '👨‍👩‍👧',
    label: 'Family',
    kind: 'reflection',
    title: 'Family time',
    note: 'A quiet prompt to reach out or write about home.',
    hour: 19,
    minute: 0,
    priority: 'normal',
    recurrenceFor: () => ({ type: 'weekly', weekdays: [0] }),
  },
  {
    id: 'household',
    emoji: '🏠',
    label: 'Household',
    kind: 'follow-up',
    title: 'Household tasks',
    note: 'Bills, chores, or a walk through the house.',
    hour: 10,
    minute: 0,
    priority: 'normal',
    recurrenceFor: () => ({ type: 'weekly', weekdays: [6] }),
  },
];

/**
 * Purpose: templates in picker order for the create flow.
 * Inputs: none.
 * Outputs: catalog copy (do not mutate).
 * Side effects: none.
 */
export function listReminderTemplates(): ReminderTemplate[] {
  return REMINDER_TEMPLATES;
}

/**
 * Purpose: look up one catalog row.
 * Inputs: template id.
 * Outputs: template or undefined.
 * Side effects: none.
 */
export function getReminderTemplate(id: string): ReminderTemplate | undefined {
  return REMINDER_TEMPLATES.find((item) => item.id === id);
}

/**
 * Purpose: turn a template into an editable draft (Controller applies this).
 * Inputs: template id and local now (for monthly/yearly day).
 * Outputs: ReminderDraft the editor can still change.
 * Side effects: none.
 * Design decisions: unknown ids fall back to Plain Text so the editor never crashes.
 */
export function draftFromTemplate(id: ReminderTemplateId | string, now: Date = new Date()): ReminderDraft {
  const template = getReminderTemplate(id) ?? REMINDER_TEMPLATES[0];
  return {
    kind: template.kind,
    title: template.title,
    note: template.note,
    hour: template.hour,
    minute: template.minute,
    enabled: true,
    recurrence: template.recurrenceFor(now),
    priority: template.priority,
    categoryPath: categoryPathForTemplate(template.id),
    templateId: template.id,
  };
}

/**
 * Purpose: display emoji for a stored templateId on list rows.
 * Inputs: optional template id.
 * Outputs: emoji or empty string.
 * Side effects: none.
 */
export function emojiForTemplateId(templateId: string | undefined): string {
  if (!templateId) {
    return '';
  }
  return getReminderTemplate(templateId)?.emoji ?? '';
}
