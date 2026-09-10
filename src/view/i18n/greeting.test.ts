import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { greetingKeyForHour } from './greeting';

describe('greetingKeyForHour', () => {
  it('uses morning from 5 through 11', () => {
    assert.equal(greetingKeyForHour(5), 'home.greetingMorning');
    assert.equal(greetingKeyForHour(11), 'home.greetingMorning');
  });

  it('uses afternoon from 12 through 16', () => {
    assert.equal(greetingKeyForHour(12), 'home.greetingAfternoon');
    assert.equal(greetingKeyForHour(16), 'home.greetingAfternoon');
  });

  it('uses evening from 17 through 20', () => {
    assert.equal(greetingKeyForHour(17), 'home.greetingEvening');
    assert.equal(greetingKeyForHour(20), 'home.greetingEvening');
  });

  it('uses night from 21 through 4', () => {
    assert.equal(greetingKeyForHour(21), 'home.greetingNight');
    assert.equal(greetingKeyForHour(0), 'home.greetingNight');
    assert.equal(greetingKeyForHour(4), 'home.greetingNight');
  });
});
