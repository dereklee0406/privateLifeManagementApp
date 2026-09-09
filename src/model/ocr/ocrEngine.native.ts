import { parseReceiptText, type OcrReceiptResult } from './receiptOcr';

export type { OcrReceiptResult };

/**
 * Purpose: on-device receipt OCR for iOS/Android without importing web-only APIs.
 * Inputs: local image URI from ImagePicker (file:// or content://).
 * Outputs: OcrReceiptResult; always runs `parseReceiptText` on whatever text was recognized.
 * Side effects: may dynamically load tesseract.js when the JS runtime supports it; never touches `document`.
 * Design decisions: Expo Go and some native builds lack a reliable WASM OCR path — failures
 *   resolve to an empty parse instead of crashing. Callers show scanning UI and handle empty text.
 */
export async function scanReceiptFromImage(imageUri: string): Promise<OcrReceiptResult> {
  const rawText = await recognizeTextSafe(imageUri);
  return parseReceiptText(rawText);
}

/**
 * Purpose: best-effort pixel OCR with hard failure isolation for Expo Go.
 * Inputs: image URI.
 * Outputs: raw OCR string, or '' when the engine is unavailable.
 * Side effects: optional dynamic import of tesseract.js.
 */
async function recognizeTextSafe(imageUri: string): Promise<string> {
  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    try {
      const {
        data: { text },
      } = await worker.recognize(imageUri);
      return text ?? '';
    } finally {
      await worker.terminate();
    }
  } catch {
    return '';
  }
}
