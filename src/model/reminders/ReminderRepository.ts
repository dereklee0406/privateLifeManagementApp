import type { CreditCardAccount } from './creditCards';
import type { Reminder } from './Reminder';

/**
 * Purpose: persistence port for reminders plus credit-card parent accounts.
 * Inputs / outputs: ReminderDocument.
 * Side effects: implemented by the data layer.
 */
export interface ReminderDocumentPort {
  reminders: Reminder[];
  creditCards: CreditCardAccount[];
}

export interface ReminderRepository {
  load(): Promise<ReminderDocumentPort>;
  save(document: ReminderDocumentPort): Promise<void>;
}
