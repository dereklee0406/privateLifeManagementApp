import { createWorker } from 'tesseract.js';
import { parseReceiptText, type OcrReceiptResult } from './receiptOcr';

export type { OcrReceiptResult };

/**
 * Purpose: on-device receipt OCR for web / PWA using tesseract.js (no cloud upload).
 * Inputs: image URI (blob:, data:, or https URL usable by the browser).
 * Outputs: OcrReceiptResult from raw OCR text + `parseReceiptText`.
 * Side effects: loads tesseract worker + language data in-browser; terminates worker after use.
 * Design decisions: eng+chi_tra+chi_sim when available would be heavy — eng covers HK bilingual
 *   receipts with Latin merchant names and amounts; always parse through domain layer.
 */
export async function scanReceiptFromImage(imageUri: string): Promise<OcrReceiptResult> {
  let rawText = '';
  try {
    const worker = await createWorker('eng');
    try {
      const {
        data: { text },
      } = await worker.recognize(imageUri);
      rawText = text ?? '';
    } finally {
      await worker.terminate();
    }
  } catch {
    rawText = '';
  }
  return parseReceiptText(rawText);
}
