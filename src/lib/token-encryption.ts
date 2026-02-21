/**
 * TOKEN ENCRYPTION UTILITIES
 *
 * Encrypts/decrypts OAuth tokens (access_token, refresh_token, id_token)
 * before storing them in the database.
 *
 * Uses AES-256-GCM encryption from src/lib/security.ts.
 * Graceful degradation: in development without ENCRYPTION_KEY, tokens
 * are stored as-is. In production, encryption failure throws.
 */

import { encrypt, decrypt } from './security';

/**
 * Encrypt a token before storing in the database.
 * Returns null if the input is null/undefined.
 */
export async function encryptToken(token: string | null | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    return await encrypt(token);
  } catch {
    // If encryption fails (e.g., missing ENCRYPTION_KEY), store as-is in dev
    if (process.env.NODE_ENV === 'development') return token;
    throw new Error('Token encryption failed - ENCRYPTION_KEY must be configured in production');
  }
}

/**
 * Decrypt a token read from the database.
 * Returns null if the input is null/undefined.
 * Falls back to returning the raw value if decryption fails
 * (handles migration period where tokens may be stored unencrypted).
 */
export async function decryptToken(token: string | null | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    return await decrypt(token);
  } catch {
    // If decryption fails, the token might be stored unencrypted (migration period)
    return token;
  }
}
