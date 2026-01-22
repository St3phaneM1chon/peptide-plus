/**
 * UTILITAIRES DE SÉCURITÉ
 * Conforme OWASP Top 10 & Chubb Requirements
 */

import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';
import { z } from 'zod';

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

  // Déchiffrer
  const decipher = createDecipheriv(ALGORITHM, key, iv);
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
export const emailSchema = z
  .string()
  .email('Email invalide')
  .max(255, 'Email trop long')
  .transform((val) => val.toLowerCase().trim());

/**
 * Schéma de validation mot de passe (conforme NYDFS)
 */
export const passwordSchema = z
  .string()
  .min(14, 'Minimum 14 caractères requis')
  .max(128, 'Maximum 128 caractères')
  .regex(/[A-Z]/, 'Au moins une majuscule requise')
  .regex(/[a-z]/, 'Au moins une minuscule requise')
  .regex(/[0-9]/, 'Au moins un chiffre requis')
  .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Au moins un caractère spécial requis');

/**
 * Schéma de validation nom
 */
export const nameSchema = z
  .string()
  .min(2, 'Minimum 2 caractères')
  .max(100, 'Maximum 100 caractères')
  .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Caractères invalides')
  .transform((val) => val.trim());

/**
 * Schéma de validation téléphone (format international)
 */
export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Format téléphone invalide');

/**
 * Schéma de validation UUID
 */
export const uuidSchema = z
  .string()
  .uuid('UUID invalide');

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
  };

  return text.replace(/[&<>"'/]/g, (char) => htmlEntities[char]);
}

/**
 * Supprime les caractères de contrôle dangereux
 */
export function sanitizeInput(input: string): string {
  // Supprimer les caractères de contrôle (sauf newline, tab)
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
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
    
    // Bloquer les URLs locales (SSRF)
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
    if (blockedHosts.includes(parsed.hostname)) {
      return null;
    }
    
    // Bloquer les IPs privées
    const privateIPPatterns = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
    ];
    
    for (const pattern of privateIPPatterns) {
      if (pattern.test(parsed.hostname)) {
        return null;
      }
    }
    
    return parsed.href;
  } catch {
    return null;
  }
}

// ============================================
// LOGGING SÉCURISÉ
// ============================================

/**
 * Masque les données sensibles dans les logs
 */
export function maskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
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
// ============================================

interface RateLimitEntry {
  count: number;
  firstRequest: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

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

// ============================================
// TOKENS CSRF
// ============================================

const csrfTokens = new Map<string, number>();

/**
 * Génère un token CSRF
 */
export function generateCsrfToken(): string {
  const token = randomBytes(32).toString('hex');
  csrfTokens.set(token, Date.now());
  
  // Nettoyer les tokens expirés (> 1 heure)
  const oneHourAgo = Date.now() - 3600000;
  for (const [t, timestamp] of csrfTokens.entries()) {
    if (timestamp < oneHourAgo) {
      csrfTokens.delete(t);
    }
  }
  
  return token;
}

/**
 * Valide un token CSRF
 */
export function validateCsrfToken(token: string): boolean {
  const timestamp = csrfTokens.get(token);
  
  if (!timestamp) {
    return false;
  }
  
  // Token valide pendant 1 heure
  const isValid = Date.now() - timestamp < 3600000;
  
  // Token à usage unique
  csrfTokens.delete(token);
  
  return isValid;
}
