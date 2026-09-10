import type { RefObject } from 'react';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import type { View } from 'react-native';

export const canCaptureMonthCard = true;

/**
 * Purpose: snapshot the month card on this phone and open the OS share sheet.
 * Inputs: mounted View ref, filename (halo-month-YYYY-MM.png).
 * Outputs: none.
 * Side effects: tmp PNG via view-shot; expo-sharing sheet. Never uploads to Halo.
 * Design decisions: same pattern as backupIO — local file, user-chosen destination.
 */
export async function captureAndShareMonthCard(
  target: RefObject<View | null>,
  filename: string,
): Promise<void> {
  if (!target.current) {
    throw new Error('Month card is not ready.');
  }
  const uri = await captureRef(target, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
    fileName: filename.replace(/\.png$/i, ''),
  });
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this phone.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'image/png',
    UTI: 'public.png',
    dialogTitle: filename,
  });
}

/**
 * Purpose: web-only text share; native uses the image path instead.
 * Inputs: unused.
 * Outputs: 'unsupported' so the View does not pretend a text share ran.
 * Side effects: none.
 */
export async function shareMonthCardText(_text: string): Promise<'shared' | 'copied' | 'unsupported'> {
  return 'unsupported';
}
