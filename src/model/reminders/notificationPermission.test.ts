import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldRequestNotificationPermission } from './notificationPermission';

describe('shouldRequestNotificationPermission', () => {
  it('prompts only when she turns a reminder on', () => {
    assert.equal(shouldRequestNotificationPermission('userEnable'), true);
  });

  it('never prompts on cold start, foreground, sound change, or restore', () => {
    assert.equal(shouldRequestNotificationPermission('coldStart'), false);
    assert.equal(shouldRequestNotificationPermission('foreground'), false);
    assert.equal(shouldRequestNotificationPermission('soundChange'), false);
    assert.equal(shouldRequestNotificationPermission('restore'), false);
  });
});
