import { gcm } from '@noble/ciphers/aes';
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha2';
import { AppConfig } from '../../config/appConfig';
import { BackupError } from './BackupDocument';
import { isBackupPasswordValid } from './backupPassword';

const MAGIC = AppConfig.backup.magic;
const KDF_ID = 'pbkdf2-sha256' as const;
const DEFAULT_ITERATIONS = AppConfig.backup.kdfIterations;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

/**
 * Purpose: opaque on-disk wrapper — ciphertext plus KDF params, never the inner journal JSON.
 * Inputs: written after encrypt; read before decrypt.
 * Outputs: JSON fields with salt / iv / ciphertext as base64.
 * Side effects: none.
 */
export interface HaloBackupEnvelope {
  v: 1;
  kdf: typeof KDF_ID;
  iter: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

/**
 * Purpose: whether this runtime can use Web Crypto SubtleCrypto (browsers; some RN builds).
 * Inputs: none.
 * Outputs: true when importKey / deriveKey / encrypt exist.
 * Side effects: none.
 */
function hasSubtle(): boolean {
  const subtle = globalThis.crypto?.subtle;
  return Boolean(subtle && typeof subtle.importKey === 'function' && typeof subtle.encrypt === 'function');
}

/**
 * Purpose: fill a buffer from the OS CSPRNG.
 * Inputs: desired length.
 * Outputs: Uint8Array of that length.
 * Side effects: none.
 * Design decisions: requires crypto.getRandomValues (web built-in; native polyfilled by ensureCsprng).
 */
function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new BackupError('corrupt', 'Secure random is unavailable.');
  }
  globalThis.crypto.getRandomValues(out);
  return out;
}

/**
 * Purpose: UTF-8 encode a string without depending on Node Buffer.
 * Inputs: JS string.
 * Outputs: bytes.
 * Side effects: none.
 */
function utf8Bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

/**
 * Purpose: UTF-8 decode bytes.
 * Inputs: Uint8Array.
 * Outputs: JS string.
 * Side effects: none.
 */
function utf8String(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * Purpose: standard base64 of binary fields in the envelope.
 * Inputs: bytes.
 * Outputs: base64 string.
 * Side effects: none.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  if (typeof btoa !== 'function') {
    throw new BackupError('corrupt');
  }
  return btoa(binary);
}

/**
 * Purpose: decode envelope base64.
 * Inputs: base64 string.
 * Outputs: bytes.
 * Side effects: none.
 */
export function base64ToBytes(value: string): Uint8Array {
  if (typeof atob !== 'function') {
    throw new BackupError('corrupt');
  }
  try {
    const binary = atob(value);
    const out = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      out[index] = binary.charCodeAt(index);
    }
    return out;
  } catch {
    throw new BackupError('corrupt');
  }
}

/**
 * Purpose: copy bytes into an ArrayBuffer Web Crypto accepts (TS BufferSource vs ArrayBufferLike).
 * Inputs: Uint8Array.
 * Outputs: ArrayBuffer of the same octets.
 * Side effects: none.
 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer as ArrayBuffer;
}

/**
 * Purpose: derive a 256-bit AES key from the user password (PBKDF2-SHA256).
 * Inputs: password, salt, iteration count.
 * Outputs: 32-byte key.
 * Side effects: none (CPU-heavy).
 * Design decisions: Web Crypto when present so web uses the platform KDF; noble PBKDF2 on RN. Same params either way so files move across platforms.
 */
async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  if (hasSubtle()) {
    try {
      const material = await globalThis.crypto.subtle.importKey(
        'raw',
        toArrayBuffer(utf8Bytes(password)),
        'PBKDF2',
        false,
        ['deriveBits'],
      );
      const bits = await globalThis.crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: toArrayBuffer(salt), iterations, hash: 'SHA-256' },
        material,
        KEY_LENGTH * 8,
      );
      return new Uint8Array(bits);
    } catch {
      // Incomplete SubtleCrypto (some RN builds) — noble PBKDF2 below.
    }
  }
  return pbkdf2Async(sha256, password, new Uint8Array(salt), { c: iterations, dkLen: KEY_LENGTH });
}

/**
 * Purpose: AES-256-GCM encrypt plaintext bytes.
 * Inputs: key (32), iv (12), plaintext.
 * Outputs: ciphertext || 16-byte tag.
 * Side effects: none.
 * Design decisions: Web Crypto AES-GCM on web; @noble/ciphers gcm on native. Wire format matches.
 */
async function aesGcmEncrypt(key: Uint8Array, iv: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array> {
  if (hasSubtle()) {
    try {
      const cryptoKey = await globalThis.crypto.subtle.importKey(
        'raw',
        toArrayBuffer(key),
        'AES-GCM',
        false,
        ['encrypt'],
      );
      const buffer = await globalThis.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: toArrayBuffer(iv) },
        cryptoKey,
        toArrayBuffer(plaintext),
      );
      return new Uint8Array(buffer);
    } catch {
      // Fall through to noble AES-GCM.
    }
  }
  return gcm(new Uint8Array(key), new Uint8Array(iv)).encrypt(new Uint8Array(plaintext));
}

/**
 * Purpose: AES-256-GCM decrypt; auth failure means wrong password or tamper.
 * Inputs: key, iv, ciphertext+tag.
 * Outputs: plaintext bytes.
 * Side effects: none.
 */
async function aesGcmDecrypt(key: Uint8Array, iv: Uint8Array, ciphertext: Uint8Array): Promise<Uint8Array> {
  if (hasSubtle()) {
    try {
      const cryptoKey = await globalThis.crypto.subtle.importKey(
        'raw',
        toArrayBuffer(key),
        'AES-GCM',
        false,
        ['decrypt'],
      );
      const buffer = await globalThis.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: toArrayBuffer(iv) },
        cryptoKey,
        toArrayBuffer(ciphertext),
      );
      return new Uint8Array(buffer);
    } catch {
      // Wrong password, tamper, or missing algorithm — try noble before failing.
    }
  }
  try {
    return gcm(new Uint8Array(key), new Uint8Array(iv)).decrypt(new Uint8Array(ciphertext));
  } catch {
    throw new BackupError('wrong-password');
  }
}

/**
 * Purpose: HALO1 + JSON envelope bytes for the written file.
 * Inputs: envelope object.
 * Outputs: file bytes.
 * Side effects: none.
 */
function encodeFile(envelope: HaloBackupEnvelope): Uint8Array {
  const magic = utf8Bytes(MAGIC);
  const body = utf8Bytes(JSON.stringify(envelope));
  const out = new Uint8Array(magic.length + body.length);
  out.set(magic, 0);
  out.set(body, magic.length);
  return out;
}

/**
 * Purpose: recognize and parse a Halo backup file.
 * Inputs: file bytes.
 * Outputs: envelope with base64 fields still encoded.
 * Side effects: none.
 * Design decisions: magic header HALO1 is required so random JSON is rejected before KDF.
 */
function decodeFile(bytes: Uint8Array): HaloBackupEnvelope {
  if (bytes.length < MAGIC.length + 2) {
    throw new BackupError('not-halo');
  }
  const magic = utf8String(bytes.subarray(0, MAGIC.length));
  if (magic !== MAGIC) {
    throw new BackupError('not-halo');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(utf8String(bytes.subarray(MAGIC.length))) as unknown;
  } catch {
    throw new BackupError('not-halo');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BackupError('not-halo');
  }
  const value = parsed as Record<string, unknown>;
  if (value.v !== 1 || value.kdf !== KDF_ID) {
    throw new BackupError('not-halo', 'This backup is not a version Halo can open.');
  }
  const iter = Number(value.iter);
  if (!Number.isFinite(iter) || iter < 1) {
    throw new BackupError('corrupt');
  }
  if (typeof value.salt !== 'string' || typeof value.iv !== 'string' || typeof value.ciphertext !== 'string') {
    throw new BackupError('corrupt');
  }
  return {
    v: 1,
    kdf: KDF_ID,
    iter,
    salt: value.salt,
    iv: value.iv,
    ciphertext: value.ciphertext,
  };
}

/**
 * Purpose: encrypt inner backup JSON with the user’s password.
 * Inputs: plaintext JSON string; backup password (min 6).
 * Outputs: HALO1 file bytes (opaque wrapper, not inner JSON).
 * Side effects: none besides CPU for PBKDF2.
 * Design decisions: password is the only secret — no hardcoded app key; salt and IV are random per export.
 */
export async function encryptBackupPayload(plaintextJson: string, password: string): Promise<Uint8Array> {
  if (!isBackupPasswordValid(password)) {
    throw new BackupError('weak-password');
  }
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = await deriveKey(password, salt, DEFAULT_ITERATIONS);
  const ciphertext = await aesGcmEncrypt(key, iv, utf8Bytes(plaintextJson));
  const envelope: HaloBackupEnvelope = {
    v: 1,
    kdf: KDF_ID,
    iter: DEFAULT_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
  };
  return encodeFile(envelope);
}

/**
 * Purpose: decrypt a Halo backup file to inner JSON.
 * Inputs: file bytes and password.
 * Outputs: plaintext JSON string.
 * Side effects: none besides CPU for PBKDF2.
 * Design decisions: GCM auth failure → wrong-password and no caller should write stores; missing HALO1 → not-halo.
 */
export async function decryptBackupPayload(fileBytes: Uint8Array, password: string): Promise<string> {
  if (!isBackupPasswordValid(password)) {
    throw new BackupError('weak-password');
  }
  const envelope = decodeFile(fileBytes);
  const salt = base64ToBytes(envelope.salt);
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  if (salt.length !== SALT_LENGTH || iv.length !== IV_LENGTH || ciphertext.length < 16) {
    throw new BackupError('corrupt');
  }
  const key = await deriveKey(password, salt, envelope.iter);
  const plaintext = await aesGcmDecrypt(key, iv, ciphertext);
  return utf8String(plaintext);
}
