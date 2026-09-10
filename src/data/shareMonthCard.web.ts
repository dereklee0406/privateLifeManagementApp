import type { RefObject } from 'react';
import type { View } from 'react-native';

export const canCaptureMonthCard = false;

/**
 * Purpose: web cannot capture a native view-shot; callers should share text or show Save on phone.
 * Inputs: unused ref + filename (API parity with native).
 * Outputs: none.
 * Side effects: none (throws so the View can fall back).
 */
export async function captureAndShareMonthCard(
  _target: RefObject<View | null>,
  _filename: string,
): Promise<void> {
  throw new Error('SAVE_ON_PHONE');
}

/**
 * Purpose: share a plain-text month summary in the browser (no image, nothing uploaded).
 * Inputs: localized summary.
 * Outputs: 'shared' | 'copied' | 'unsupported'.
 * Side effects: Web Share API or clipboard write.
 */
export async function shareMonthCardText(text: string): Promise<'shared' | 'copied' | 'unsupported'> {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  if (nav && typeof nav.share === 'function') {
    try {
      await nav.share({ title: 'Halo', text });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'unsupported';
      }
    }
  }
  if (nav?.clipboard && typeof nav.clipboard.writeText === 'function') {
    await nav.clipboard.writeText(text);
    return 'copied';
  }
  return 'unsupported';
}
