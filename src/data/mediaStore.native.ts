import { Directory, File, Paths } from 'expo-file-system';
import { createId } from '../utils/idUtils';

export type MediaKind = 'photo' | 'voice';

const MEDIA_DIR = 'halo-media';

/**
 * tsc resolves expo-file-system's ExpoFileSystem.web.d.ts via moduleSuffixes, which omits native File/Directory methods.
 * Runtime on Android/iOS still has them; this local shape keeps native persistence typed.
 */
interface NativeDirectory {
  exists: boolean;
  create: (options?: { intermediates?: boolean; idempotent?: boolean }) => void;
}

interface NativeFile {
  uri: string;
  exists: boolean;
  copy: (destination: NativeFile) => void | Promise<void>;
  delete: () => void;
}

function asDirectory(value: Directory): NativeDirectory {
  return value as unknown as NativeDirectory;
}

function asFile(value: File): NativeFile {
  return value as unknown as NativeFile;
}

function extensionOf(uri: string, kind: MediaKind): string {
  const clean = uri.split('?')[0] ?? uri;
  const match = clean.match(/\.([a-zA-Z0-9]+)$/);
  if (match) {
    return `.${match[1].toLowerCase()}`;
  }
  return kind === 'voice' ? '.m4a' : '.jpg';
}

/**
 * Purpose: decide whether a URI already lives in the app document folder.
 * Inputs: media URI.
 * Outputs: true when copy is unnecessary.
 * Side effects: none.
 */
export function isPersistedMedia(uri: string): boolean {
  return uri.includes(`/${MEDIA_DIR}/`) || uri.includes(`${MEDIA_DIR}%2F`);
}

function ensureMediaDirectory(): void {
  const dir = asDirectory(new Directory(Paths.document, MEDIA_DIR));
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
}

/**
 * Purpose: copy a picker/recorder temp file into the durable document directory.
 * Inputs: temporary URI and whether it is a photo or voice clip.
 * Outputs: document-directory URI stored on the journal page.
 * Side effects: creates halo-media/ and copies bytes on disk. Never writes binaries to AsyncStorage.
 * Design decisions: Expo 57 File API. Already-persisted URIs are returned as-is.
 *   Files live under the app document folder (not the public MediaStore gallery), so they are not
 *   offered to Google Photos / Drive Auto Backup. android.allowBackup is false in app.json.
 */
export async function persistMediaFile(tempUri: string, kind: MediaKind): Promise<string> {
  if (!tempUri) {
    return tempUri;
  }
  if (isPersistedMedia(tempUri)) {
    return tempUri;
  }
  ensureMediaDirectory();
  const dest = asFile(new File(Paths.document, MEDIA_DIR, `${createId()}${extensionOf(tempUri, kind)}`));
  const source = asFile(new File(tempUri));
  await Promise.resolve(source.copy(dest));
  return dest.uri;
}

/**
 * Purpose: delete a persisted media file when a page or attachment is removed.
 * Inputs: stored URI.
 * Outputs: none.
 * Side effects: deletes the file when it belongs to halo-media.
 */
export async function removeMediaFile(uri: string): Promise<void> {
  if (!uri || !isPersistedMedia(uri)) {
    return;
  }
  try {
    const file = asFile(new File(uri));
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Missing files should not block deleting the journal page.
  }
}

/**
 * Purpose: resolve a stored URI into something Image/Audio can play.
 * Inputs: stored URI.
 * Outputs: same URI on native.
 * Side effects: none.
 */
export async function resolveMediaUri(uri: string): Promise<string> {
  return uri;
}
