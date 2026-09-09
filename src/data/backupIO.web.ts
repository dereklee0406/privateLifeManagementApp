/**
 * Purpose: a picked backup file’s bytes (opaque HALO1 payload).
 * Inputs: native document picker or web file input.
 * Outputs: bytes plus display name.
 * Side effects: none (type only).
 */
export interface PickedBackupFile {
  bytes: Uint8Array;
  name: string;
}

/**
 * Purpose: download encrypted backup bytes as a file in the browser.
 * Inputs: HALO1 file bytes and filename.
 * Outputs: none.
 * Side effects: object-URL download click; revoked after.
 */
export async function shareBackupFile(
  bytes: Uint8Array,
  filename: string,
  mimeType = 'application/octet-stream',
): Promise<void> {
  const copy = new Uint8Array(bytes);
  const blob = new Blob([copy], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Purpose: pick a Halo backup via a hidden file input.
 * Inputs: none (user gesture required).
 * Outputs: file bytes or null when cancelled.
 * Side effects: reads the chosen File as ArrayBuffer.
 */
export async function pickBackupFile(): Promise<PickedBackupFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.halo,application/octet-stream,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      void file.arrayBuffer().then((buffer) => {
        resolve({ bytes: new Uint8Array(buffer), name: file.name });
      });
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
