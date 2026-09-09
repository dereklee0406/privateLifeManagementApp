import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * tsc resolves expo-file-system's web typings via moduleSuffixes, which omit native File methods.
 * Runtime Android/iOS File still has exists / create / write / bytes.
 */
interface NativeBackupFile {
  uri: string;
  exists: boolean;
  create: (options?: { overwrite?: boolean }) => void;
  write: (content: string | Uint8Array) => void;
  delete: () => void;
  bytes: () => Promise<Uint8Array>;
}

/**
 * Purpose: assert native File methods that web typings omit.
 * Inputs: expo-file-system File instance.
 * Outputs: NativeBackupFile view.
 * Side effects: none.
 */
function asNativeFile(value: File): NativeBackupFile {
  return value as unknown as NativeBackupFile;
}

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
 * Purpose: write encrypted bytes to cache and open the OS share sheet (Save to Files / Drive).
 * Inputs: HALO1 file bytes and halo-backup-YYYY-MM-DD.halo filename.
 * Outputs: none.
 * Side effects: cache file create; expo-sharing sheet. Never uploads to Halo.
 */
export async function shareBackupFile(
  bytes: Uint8Array,
  filename: string,
  mimeType = 'application/octet-stream',
): Promise<void> {
  const file = asNativeFile(new File(Paths.cache, filename));
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(bytes);
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this phone.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType,
    UTI: mimeType === 'text/csv' ? 'public.comma-separated-values-text' : 'public.data',
    dialogTitle: filename,
  });
}

/**
 * Purpose: pick a .halo (or renamed) backup via the system document picker.
 * Inputs: none (user gesture).
 * Outputs: file bytes or null when cancelled.
 * Side effects: copies the pick into cache so File can read it.
 */
export async function pickBackupFile(): Promise<PickedBackupFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/octet-stream', 'application/json', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets[0]) {
    return null;
  }
  const asset = result.assets[0];
  const file = asNativeFile(new File(asset.uri));
  const bytes = await file.bytes();
  return { bytes, name: asset.name || 'halo-backup.halo' };
}
