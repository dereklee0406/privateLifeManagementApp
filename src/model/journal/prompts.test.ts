import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getDailyPrompt, isPromptId, PROMPT_CATALOG, PROMPT_PACKS, promptsInPack } from './prompts';

describe('prompt library catalog', () => {
  it('tags every id with today, gratitude, review, or focus', () => {
    assert.deepEqual([...PROMPT_PACKS], ['today', 'gratitude', 'review', 'focus']);
    assert.equal(promptsInPack('today').length, 12);
    assert.equal(promptsInPack('gratitude').length, 6);
    assert.equal(promptsInPack('review').length, 6);
    assert.equal(promptsInPack('focus').length, 6);
    assert.equal(PROMPT_CATALOG.length, 30);
    for (const row of PROMPT_CATALOG) {
      assert.equal(row.id.startsWith(`${row.pack}.`), true);
      assert.equal(isPromptId(row.id), true);
    }
    assert.equal(isPromptId('today.missing'), false);
  });
});

describe('getDailyPrompt', () => {
  it('rotates inside the Today pack and is stable for a civil day', () => {
    const morning = new Date(2026, 8, 10, 8);
    const evening = new Date(2026, 8, 10, 21);
    const nextDay = new Date(2026, 8, 11, 8);
    const first = getDailyPrompt(morning);
    assert.equal(promptsInPack('today').includes(first), true);
    assert.equal(getDailyPrompt(evening), first);
    assert.equal(getDailyPrompt(nextDay) === first || promptsInPack('today').includes(getDailyPrompt(nextDay)), true);
  });
});
