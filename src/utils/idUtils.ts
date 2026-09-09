/**
 * Purpose: create a unique id for new journal pages.
 * Inputs: none.
 * Outputs: UUID string.
 * Side effects: none.
 * Design decisions: prefer crypto.randomUUID when present; fall back so web/dev still works.
 */
export function createId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `halo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
