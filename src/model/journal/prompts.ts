/**
 * Purpose: rotating daily prompts so the home screen always has a writing invitation.
 * Inputs: none (catalog), or a Date for selection.
 * Outputs: prompt string for the local calendar day.
 * Side effects: none.
 * Design decisions: hash by date so Android and iOS show the same prompt for a given day.
 */
const DAILY_PROMPTS: readonly string[] = [
  'What did you notice that you almost walked past?',
  'Which conversation is still sitting in your chest?',
  'If today had a temperature, what would it be and why?',
  'What did you protect today — time, energy, someone else?',
  'Write the sentence you needed to hear this morning.',
  'What felt unfinished, and can it wait until tomorrow?',
  'Name one ordinary thing that quietly went well.',
  'Where were you kind without keeping score?',
  'What would you tell yesterday-you with a softer voice?',
  'Which small ritual made the day more livable?',
  'What are you carrying that is not actually yours?',
  'Describe a color from today without naming the object.',
];

/**
 * Purpose: pick a stable prompt for a local calendar day.
 * Inputs: date (defaults to now).
 * Outputs: prompt string from the catalog.
 * Side effects: none.
 */
export function getDailyPrompt(now: Date = new Date()): string {
  const seed = now.getFullYear() * 1000 + (now.getMonth() + 1) * 50 + now.getDate();
  return DAILY_PROMPTS[seed % DAILY_PROMPTS.length];
}
