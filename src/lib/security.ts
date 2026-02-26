/**
 * UTILITAIRES DE SÉCURITÉ
 * Conforme OWASP Top 10 & Chubb Requirements
 *
 * TODO: FAILLE-083 - createSecurityLog returns JSON string; return object to avoid double-stringify
 * TODO: FAILLE-084 - decrypt() does not validate minimum buffer length before slicing; add length check
 * TODO: FAILLE-087 - setInterval timers in this file are not tracked; create a central timer registry
 * TODO: FAILLE-090 - Email masking logic differs between maskSensitiveData and admin-audit; unify into maskPII()
 * TODO: FAILLE-093 - phoneSchema only accepts E.164 format; consider libphonenumber-js for local format support
 */

import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';
import { z } from 'zod';
import { PASSWORD_MIN_LENGTH } from '@/lib/constants';

const scryptAsync = promisify(scrypt);

// ============================================
// CHIFFREMENT AES-256-GCM
// ============================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

/**
 * Chiffre une donnée sensible avec AES-256-GCM
 */
export async function encrypt(plaintext: string): Promise<string> {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY not configured');
  }

  // Générer un salt et IV uniques
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);

  // Dériver la clé avec scrypt
  const key = (await scryptAsync(encryptionKey, salt, KEY_LENGTH)) as Buffer;

  // Chiffrer
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  // Récupérer le tag d'authentification
  const authTag = cipher.getAuthTag();

  // Combiner: salt + iv + authTag + encrypted
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);

  return combined.toString('base64');
}

/**
 * Déchiffre une donnée chiffrée avec AES-256-GCM
 */
export async function decrypt(encryptedData: string): Promise<string> {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY not configured');
  }

  const combined = Buffer.from(encryptedData, 'base64');

  // Extraire les composants
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = combined.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  );
  const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  // Dériver la clé
  const key = (await scryptAsync(encryptionKey, salt, KEY_LENGTH)) as Buffer;

  // Déchiffrer (authTagLength required by GCM spec to prevent tag truncation attacks)
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

// ============================================
// VALIDATION DES ENTRÉES (Zod Schemas)
// ============================================

/**
 * Schéma de validation email
 */
// FAILLE-042 FIX: Use English error codes (frontend translates via i18n)
export const emailSchema = z
  .string()
  .email('invalid_email')
  .max(255, 'email_too_long')
  .transform((val) => val.toLowerCase().trim());

/**
 * Schéma de validation mot de passe (conforme NYDFS)
 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, 'password_min_length')
  .max(128, 'password_max_length')
  .regex(/[A-Z]/, 'password_uppercase_required')
  .regex(/[a-z]/, 'password_lowercase_required')
  .regex(/[0-9]/, 'password_digit_required')
  .regex(/[!@#$%^&*(),.?":{}|<>]/, 'password_special_required');

/**
 * Schéma de validation nom
 */
export const nameSchema = z
  .string()
  .min(2, 'name_min_length')
  .max(100, 'name_max_length')
  // F-055 FIX: Use Unicode letter class to support all scripts and exclude math symbols (×÷) from À-ÿ range
  .regex(/^[\p{L}\s'-]+$/u, 'name_invalid_chars')
  .transform((val) => val.trim());

/**
 * Schéma de validation téléphone (format international)
 */
export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'phone_invalid_format');

/**
 * Schéma de validation UUID
 */
export const uuidSchema = z
  .string()
  .uuid('uuid_invalid');

// ============================================
// SANITIZATION
// ============================================

/**
 * Échappe les caractères HTML pour prévenir XSS
 */
export function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    // FAILLE-037 FIX: Escape backtick to prevent template literal injection
    '`': '&#x60;',
  };

  return text.replace(/[&<>"'/`]/g, (char) => htmlEntities[char]);
}

/**
 * Supprime les caractères de contrôle dangereux
 */
export function sanitizeInput(input: string): string {
  // Supprimer les caractères de contrôle (sauf newline, tab)
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Checks whether a hostname resolves to a private, reserved, or loopback IP address.
 * Covers all RFC-defined private/reserved IPv4 and IPv6 ranges to prevent SSRF attacks.
 *
 * FAILLE-016 FIX (complete): Added IPv6 loopback (::1), link-local (fe80::/10),
 * ULA (fc00::/7), CGNAT (100.64.0.0/10), and all other reserved ranges.
 */
export function isPrivateOrReservedIP(hostname: string): boolean {
  // Normalize: strip IPv6 bracket notation (e.g. [::1] → ::1)
  const host = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;

  // ---- IPv4 blocked names and addresses ----
  const blockedHostnames = ['localhost', '0.0.0.0'];
  if (blockedHostnames.includes(host.toLowerCase())) return true;

  const ipv4Patterns = [
    /^127\./,                                      // IPv4 loopback (127.0.0.0/8)
    /^10\./,                                       // RFC 1918 class A private
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,             // RFC 1918 class B private
    /^192\.168\./,                                 // RFC 1918 class C private
    /^169\.254\./,                                 // Link-local / Azure IMDS (169.254.169.254)
    /^100\.(6[4-9]|[7-9]\d|1[0-2]\d|127)\./,      // CGNAT / carrier-grade NAT (100.64.0.0/10)
    /^198\.18\./,                                  // Benchmark testing (198.18.0.0/15)
    /^198\.19\./,                                  // Benchmark testing (198.19.0.0/15)
    /^198\.51\.100\./,                             // TEST-NET-2 (RFC 5737)
    /^203\.0\.113\./,                              // TEST-NET-3 (RFC 5737)
    /^192\.0\.2\./,                                // TEST-NET-1 (RFC 5737)
    /^192\.88\.99\./,                              // 6to4 relay anycast (deprecated, RFC 7526)
    /^240\./,                                      // Reserved (240.0.0.0/4)
    /^255\.255\.255\.255$/,                        // Broadcast
    /^0\./,                                        // This network (0.0.0.0/8)
  ];

  for (const pattern of ipv4Patterns) {
    if (pattern.test(host)) return true;
  }

  // ---- IPv6 blocked addresses and ranges ----
  const normalizedIPv6 = host.toLowerCase();

  // ::1 — IPv6 loopback
  if (normalizedIPv6 === '::1') return true;

  // :: — unspecified address
  if (normalizedIPv6 === '::') return true;

  const ipv6Patterns = [
    /^fe[89ab][0-9a-f]:/i,    // fe80::/10 — link-local (fe80–febf)
    /^fc[0-9a-f]{2}:/i,       // fc00::/7 — ULA first half (fc00–fdff)
    /^fd[0-9a-f]{2}:/i,       // fc00::/7 — ULA second half
    /^::ffff:/i,               // IPv4-mapped (::ffff:0:0/96) — covers all IPv4-mapped
    /^64:ff9b:/i,              // IPv4/IPv6 translation (64:ff9b::/96, RFC 6052)
    /^100::/i,                 // Discard prefix (100::/64, RFC 6666)
    /^2001:db8:/i,             // Documentation (2001:db8::/32, RFC 3849)
    /^2001::/i,                // Teredo tunneling (2001::/32)
    /^2002:/i,                 // 6to4 (2002::/16)
  ];

  for (const pattern of ipv6Patterns) {
    if (pattern.test(normalizedIPv6)) return true;
  }

  return false;
}

/**
 * Valide et sanitize une URL
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);

    // N'autoriser que HTTP(S)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    // Bloquer les IPs/hostnames privés, réservés ou locaux (SSRF) — FAILLE-016 COMPLETE FIX
    if (isPrivateOrReservedIP(parsed.hostname)) {
      return null;
    }

    return parsed.href;
  } catch (error) {
    console.error('[Security] URL validation failed:', error);
    return null;
  }
}

// ============================================
// LOGGING SÉCURISÉ
// ============================================

/**
 * Masque les données sensibles dans les logs
 */
// FIX: FAILLE-073 - Made maskSensitiveData recursive to handle nested objects
export function maskSensitiveData(data: Record<string, unknown>, depth = 0): Record<string, unknown> {
  // Prevent infinite recursion on deeply nested or circular structures
  if (depth > 5) return data;

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'apiKey',
    'api_key',
    'authorization',
    'credit_card',
    'creditCard',
    'ssn',
    'sin',
    'birthdate',
    'dateOfBirth',
  ];

  const masked = { ...data };

  for (const field of sensitiveFields) {
    if (field in masked) {
      masked[field] = '***REDACTED***';
    }
  }

  // Masquer partiellement les emails
  if (typeof masked.email === 'string') {
    const [local, domain] = masked.email.split('@');
    masked.email = `${local.substring(0, 2)}***@${domain}`;
  }

  // FIX: FAILLE-073 - Recurse into nested objects to mask sensitive fields at all levels
  for (const key of Object.keys(masked)) {
    if (masked[key] && typeof masked[key] === 'object' && !Array.isArray(masked[key])) {
      masked[key] = maskSensitiveData(masked[key] as Record<string, unknown>, depth + 1);
    }
  }

  return masked;
}

/**
 * Crée une entrée de log structurée et sécurisée
 */
export function createSecurityLog(
  level: 'info' | 'warn' | 'error' | 'critical',
  event: string,
  data: Record<string, unknown>
): string {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    data: maskSensitiveData(data),
  };

  return JSON.stringify(logEntry);
}

// ============================================
// RATE LIMITING
// Prefer rate-limiter.ts for rate limiting in API routes.
// This is a basic in-memory implementation kept for simple utility use.
// ============================================

interface RateLimitEntry {
  count: number;
  firstRequest: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// P-08 FIX: Maximum number of entries in the rate limit store
const RATE_LIMIT_STORE_MAX_SIZE = 10_000;

/**
 * P-08 FIX: Evict the oldest half of rateLimitStore when it exceeds the max size.
 * Maps maintain insertion order, so the first keys are the oldest entries.
 */
function enforceRateLimitStoreMaxSize(): void {
  if (rateLimitStore.size <= RATE_LIMIT_STORE_MAX_SIZE) return;
  const toDelete = Math.floor(rateLimitStore.size / 2);
  let deleted = 0;
  for (const key of rateLimitStore.keys()) {
    if (deleted >= toDelete) break;
    rateLimitStore.delete(key);
    deleted++;
  }
}

// FAILLE-038 FIX: Store interval IDs for proper cleanup
let rateLimitCleanupInterval: ReturnType<typeof setInterval> | null = null;

// Periodic cleanup of expired rate limit entries (every 5 minutes)
rateLimitCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    // Remove entries older than 10 minutes (generous window)
    if (now - entry.firstRequest > 600_000) {
      rateLimitStore.delete(key);
    }
  }
}, 300_000);

/**
 * Vérifie le rate limit pour une clé donnée
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Nouvelle entrée ou fenêtre expirée
  if (!entry || now - entry.firstRequest > windowMs) {
    enforceRateLimitStoreMaxSize();
    rateLimitStore.set(key, { count: 1, firstRequest: now });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetIn: windowMs,
    };
  }

  // Mise à jour du compteur
  entry.count++;

  if (entry.count > maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: windowMs - (now - entry.firstRequest),
    };
  }

  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetIn: windowMs - (now - entry.firstRequest),
  };
}

// AMELIORATION A-005 / IMP-005: Removed duplicate in-memory CSRF implementation.
// All CSRF protection is handled by csrf.ts + csrf-middleware.ts (HMAC-signed, cookie-based).

// FAILLE-038 FIX: Expose cleanup function for graceful shutdown
export function cleanupSecurityIntervals(): void {
  if (rateLimitCleanupInterval) { clearInterval(rateLimitCleanupInterval); rateLimitCleanupInterval = null; }
}
if (typeof process !== 'undefined') {
  process.on('SIGTERM', cleanupSecurityIntervals);
}
