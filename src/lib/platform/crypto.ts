/**
 * Platform Token Encryption
 * AES-256-GCM encryption/decryption for OAuth tokens stored in PlatformConnection
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || process.env.PLATFORM_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY (or PLATFORM_ENCRYPTION_KEY) environment variable is not set');
  }
  // Accept hex-encoded 32-byte key (64 hex chars)
  if (key.length === 64) {
    return Buffer.from(key, 'hex');
  }
  // Accept raw 32-byte string
  if (key.length === 32) {
    return Buffer.from(key, 'utf-8');
  }
  throw new Error('PLATFORM_ENCRYPTION_KEY must be 32 bytes (64 hex chars or 32 raw chars)');
}

/**
 * Encrypt a plaintext string. Returns base64-encoded string containing IV + ciphertext + auth tag.
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf-8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: IV (16) + AuthTag (16) + Ciphertext
  const result = Buffer.concat([iv, authTag, encrypted]);
  return result.toString('base64');
}

/**
 * Decrypt a base64-encoded encrypted string.
 */
export function decrypt(encryptedBase64: string): string {
  const key = getEncryptionKey();
  const data = Buffer.from(encryptedBase64, 'base64');

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf-8');
}

/**
 * Encrypt a token value, returning null if the input is null/undefined.
 */
export function encryptToken(token: string | null | undefined): string | null {
  if (!token) return null;
  return encrypt(token);
}

/**
 * Decrypt a token value, returning null if the input is null/undefined.
 */
export function decryptToken(encrypted: string | null | undefined): string | null {
  if (!encrypted) return null;
  try {
    return decrypt(encrypted);
  } catch {
    return null;
  }
}
