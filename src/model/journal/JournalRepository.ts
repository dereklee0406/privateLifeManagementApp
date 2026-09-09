import type { JournalEntry } from './JournalEntry';

/**
 * Purpose: persistence port for journal pages.
 * Inputs: domain entries only — no React Native types.
 * Outputs: stored JournalEntry records.
 * Side effects: implemented by the data layer.
 * Design decisions: interface lives in Model so Controllers stay testable without AsyncStorage.
 */
export interface JournalRepository {
  loadAll(): Promise<JournalEntry[]>;
  saveAll(entries: JournalEntry[]): Promise<void>;
}
