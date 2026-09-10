import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { leaveScreen } from './navigation';

describe('leaveScreen', () => {
  it('pops the stack when there is history', () => {
    const calls: string[] = [];
    leaveScreen({
      canGoBack: () => true,
      back: () => {
        calls.push('back');
      },
      replace: () => {
        calls.push('replace');
      },
    });
    assert.deepEqual(calls, ['back']);
  });

  it('replaces Today when the stack is empty so Android back cannot freeze', () => {
    const calls: string[] = [];
    leaveScreen({
      canGoBack: () => false,
      back: () => {
        calls.push('back');
      },
      replace: (href: string) => {
        calls.push(`replace:${href}`);
      },
    });
    assert.deepEqual(calls, ['replace:/(tabs)']);
  });
});
