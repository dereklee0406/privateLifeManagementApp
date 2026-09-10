import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lockAfterTimeoutMs, resolveLockAfterSeconds } from './AppSettings';

describe('lock after', () => {
  it('maps Settings chips to 0 / 60 / 300 seconds', () => {
    assert.equal(resolveLockAfterSeconds({ lockAfterSeconds: 0 }), 0);
    assert.equal(resolveLockAfterSeconds({ lockAfterSeconds: 60 }), 60);
    assert.equal(resolveLockAfterSeconds({ lockAfterSeconds: 300 }), 300);
  });

  it('defaults missing values to 1 minute', () => {
    assert.equal(resolveLockAfterSeconds({}), 60);
    assert.equal(lockAfterTimeoutMs({}), 60_000);
  });

  it('matches Right away / 1 minute / 5 minutes in milliseconds', () => {
    assert.equal(lockAfterTimeoutMs({ lockAfterSeconds: 0 }), 0);
    assert.equal(lockAfterTimeoutMs({ lockAfterSeconds: 60 }), 60_000);
    assert.equal(lockAfterTimeoutMs({ lockAfterSeconds: 300 }), 300_000);
  });
});
