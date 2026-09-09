import { createId } from '../utils/idUtils';

export type MediaKind = 'photo' | 'voice';

const DB_NAME = 'halo-media';
const STORE = 'files';
const PREFIX = 'halo-idb://';

const objectUrlCache = new Map<string, string>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Purpose: decide whether a URI is already a Halo IndexedDB media id.
 * Inputs: media URI.
 * Outputs: true when copy is unnecessary.
 * Side effects: none.
 */
export function isPersistedMedia(uri: string): boolean {
  return uri.startsWith(PREFIX);
}

/**
 * Purpose: persist a web file/blob URI without putting binaries in AsyncStorage.
 * Inputs: blob: or https URI from a file input, and media kind.
 * Outputs: halo-idb:// id stored on the journal page JSON.
 * Side effects: writes a Blob into IndexedDB.
 * Design decisions: web has no durable documentDirectory; IndexedDB keeps photos across reloads without crashing Metro.
 */
export async function persistMediaFile(tempUri: string, _kind: MediaKind): Promise<string> {
  if (!tempUri) {
    return tempUri;
  }
  if (isPersistedMedia(tempUri)) {
    return tempUri;
  }
  const response = await fetch(tempUri);
  const blob = await response.blob();
  const id = createId();
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return `${PREFIX}${id}`;
}

/**
 * Purpose: drop a web media blob when the page or attachment is removed.
 * Inputs: stored URI.
 * Outputs: none.
 * Side effects: IndexedDB delete and object-URL revoke.
 */
export async function removeMediaFile(uri: string): Promise<void> {
  if (!isPersistedMedia(uri)) {
    return;
  }
  const id = uri.slice(PREFIX.length);
  const cached = objectUrlCache.get(id);
  if (cached) {
    URL.revokeObjectURL(cached);
    objectUrlCache.delete(id);
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Purpose: turn a halo-idb id into a blob URL the Image component can render.
 * Inputs: stored URI.
 * Outputs: blob: URL or the original URI.
 * Side effects: may create an object URL.
 */
export async function resolveMediaUri(uri: string): Promise<string> {
  if (!isPersistedMedia(uri)) {
    return uri;
  }
  const id = uri.slice(PREFIX.length);
  const cached = objectUrlCache.get(id);
  if (cached) {
    return cached;
  }
  const db = await openDb();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error);
  });
  if (!blob) {
    return uri;
  }
  const objectUrl = URL.createObjectURL(blob);
  objectUrlCache.set(id, objectUrl);
  return objectUrl;
}
