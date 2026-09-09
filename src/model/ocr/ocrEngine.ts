import { parseReceiptText, type OcrReceiptResult } from './receiptOcr';

/**
 * Purpose: public OCR facade API (TypeScript / non-platform fallback).
 * Inputs: local image URI (file://, blob:, content:, or https).
 * Outputs: Promise of parsed receipt fields via `parseReceiptText`.
 * Side effects: none in this fallback — Metro prefers `ocrEngine.native` / `ocrEngine.web` at runtime.
 * Design decisions: keep a shared export shape so callers import `../../model/ocr/ocrEngine` once;
 *   platform files override recognition; this module only re-exports types and a safe stub.
 */
export type { OcrReceiptResult };

/**
 * Purpose: fallback scan when no platform engine is resolved (should be rare under Expo).
 * Inputs: imageUri (ignored — no pixel OCR in the shared stub).
 * Outputs: empty parsed result so callers never crash.
 * Side effects: none.
 */
export async function scanReceiptFromImage(_imageUri: string): Promise<OcrReceiptResult> {
  return parseReceiptText('');
}
