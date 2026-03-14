/**
 * TOKEN ENCRYPTION UTILITIES
 *
 * Encrypts/decrypts OAuth tokens (access_token, refresh_token, id_token)
 * before storing them in the database.
 *
 * Uses AES-256-GCM encryption from src/lib/security.ts.
 * F6 FIX: Encrypted tokens are prefixed with 'enc:' to distinguish
 * from plaintext tokens during migration period.
 */

import { encrypt, decrypt } from './security';
import { logger } from '@/lib/logger';

const ENCRYPTED_PREFIX = 'enc:';

/**
 * Encrypt a token before storing in the database.
 * Returns null if the input is null/undefined.
 * Prefixes encrypted output with 'enc:' for safe identification.
 */
export async function encryptToken(token: string | null | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const encrypted = await encrypt(token);
    return ENCRYPTED_PREFIX + encrypted;
  } catch {
    // If encryption fails (e.g., missing ENCRYPTION_KEY), store as-is in dev
    if (process.env.NODE_ENV === 'development') return token;
    throw new Error('Token encryption failed - ENCRYPTION_KEY must be configured in production');
  }
}

/**
 * Decrypt a token read from the database.
 * Returns null if the input is null/undefined.
 * F6 FIX: Only attempts decryption if token has 'enc:' prefix.
 * Unencrypted tokens (migration period) are returned as-is in dev,
 * but logged as warning in production.
 */
export async function decryptToken(token: string | null | undefined): Promise<string | null> {
  if (!token) return null;

  // Token is encrypted — strip prefix and decrypt
  if (token.startsWith(ENCRYPTED_PREFIX)) {
    const ciphertext = token.slice(ENCRYPTED_PREFIX.length);
    return await decrypt(ciphertext);
  }

  // Token is NOT encrypted (migration period — stored before encryption was enabled)
  if (process.env.NODE_ENV === 'production') {
    // In production, log warning but still return to avoid breaking existing sessions
    logger.warn('[TokenEncryption] Unencrypted token detected in production — schedule re-encryption');
  }
  return token;
}
