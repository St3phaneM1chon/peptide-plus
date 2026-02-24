/**
 * PROTECTION BRUTE FORCE - Conforme NYDFS 23 NYCRR 500
 * Lockout après tentatives échouées + notification
 */

import { prisma } from './db';
import { createSecurityLog } from './security';
import { getRedisClient, isRedisAvailable } from './redis';
import { logger } from '@/lib/logger';

// Configuration
const MAX_FAILED_ATTEMPTS = 3;         // Nombre max de tentatives (Chubb: 3)
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes de lockout
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;   // Fenêtre de 15 minutes
const REDIS_KEY_PREFIX = 'bf:login:';
const REDIS_TTL_SECONDS = 15 * 60; // 15 minutes TTL for Redis keys
const MAP_MAX_SIZE = 10_000; // FAILLE-005: Max entries in fallback Map

// Cache en mémoire pour les performances (fallback when Redis unavailable)
const loginAttempts = new Map<string, {
  attempts: number;
  firstAttempt: number;
  lockedUntil: number | null;
}>();

// FAILLE-005: Helper to enforce Map size limit
function enforceMapSizeLimit(): void {
  if (loginAttempts.size <= MAP_MAX_SIZE) return;
  // Remove oldest entries (first inserted = first iterated in Map)
  const entriesToRemove = loginAttempts.size - MAP_MAX_SIZE + 1000; // remove 1000 extra to avoid frequent cleanup
  let removed = 0;
  for (const key of loginAttempts.keys()) {
    if (removed >= entriesToRemove) break;
    loginAttempts.delete(key);
    removed++;
  }
}

// FAILLE-005: Redis-backed attempt tracking helpers
async function getRedisRecord(key: string): Promise<{ attempts: number; firstAttempt: number; lockedUntil: number | null } | null> {
  try {
    const redis = await getRedisClient();
    if (!redis) return null;
    const data = await redis.get(`${REDIS_KEY_PREFIX}${key}`);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function setRedisRecord(key: string, record: { attempts: number; firstAttempt: number; lockedUntil: number | null }): Promise<boolean> {
  try {
    const redis = await getRedisClient();
    if (!redis) return false;
    await redis.set(`${REDIS_KEY_PREFIX}${key}`, JSON.stringify(record), 'EX', REDIS_TTL_SECONDS);
    return true;
  } catch {
    return false;
  }
}

async function deleteRedisRecord(key: string): Promise<void> {
  try {
    const redis = await getRedisClient();
    if (redis) await redis.del(`${REDIS_KEY_PREFIX}${key}`);
  } catch { /* ignore */ }
}

/**
 * Vérifie si un compte est verrouillé
 */
export async function isAccountLocked(email: string): Promise<{
  locked: boolean;
  remainingTime: number;
  attempts: number;
}> {
  const key = email.toLowerCase();
  const now = Date.now();

  // FAILLE-005: Try Redis first, fall back to Map
  const record = isRedisAvailable()
    ? (await getRedisRecord(key)) ?? loginAttempts.get(key)
    : loginAttempts.get(key);

  if (!record) {
    return { locked: false, remainingTime: 0, attempts: 0 };
  }

  // Vérifier si le lockout est expiré
  if (record.lockedUntil && record.lockedUntil > now) {
    return {
      locked: true,
      remainingTime: record.lockedUntil - now,
      attempts: record.attempts,
    };
  }

  // Réinitialiser si la fenêtre est expirée
  if (now - record.firstAttempt > ATTEMPT_WINDOW_MS) {
    loginAttempts.delete(key);
    deleteRedisRecord(key).catch(() => {});
    return { locked: false, remainingTime: 0, attempts: 0 };
  }

  return {
    locked: false,
    remainingTime: 0,
    attempts: record.attempts,
  };
}

/**
 * Enregistre une tentative de connexion échouée
 */
export async function recordFailedAttempt(
  email: string,
  ipAddress: string,
  userAgent: string
): Promise<{
  locked: boolean;
  attemptsRemaining: number;
}> {
  const key = email.toLowerCase();
  const now = Date.now();

  // FAILLE-005: Try Redis first, fall back to Map
  let record = isRedisAvailable()
    ? (await getRedisRecord(key)) ?? loginAttempts.get(key)
    : loginAttempts.get(key);

  // Nouvelle entrée ou fenêtre expirée
  if (!record || now - record.firstAttempt > ATTEMPT_WINDOW_MS) {
    record = {
      attempts: 1,
      firstAttempt: now,
      lockedUntil: null,
    };
  } else {
    record.attempts++;
  }

  // Store in Redis if available, otherwise Map with size limit
  const storedInRedis = await setRedisRecord(key, record);
  if (!storedInRedis) {
    enforceMapSizeLimit();
    loginAttempts.set(key, record);
  }

  // Log de sécurité
  logger.info('Security event: failed login attempt', { event: 'failed_login_attempt', email: key, ipAddress, userAgent, attemptNumber: record.attempts, maxAttempts: MAX_FAILED_ATTEMPTS });

  // Stocker dans la base de données pour audit
  await prisma.auditLog.create({
    data: {
      action: 'FAILED_LOGIN',
      entityType: 'User',
      entityId: key,
      details: JSON.stringify({
        ipAddress,
        userAgent,
        attemptNumber: record.attempts,
        timestamp: new Date().toISOString(),
      }),
    },
  }).catch((e) => logger.error('Audit log failed', { error: e instanceof Error ? e.message : String(e) })); // FAILLE-058 FIX: Log errors instead of silencing

  // Vérifier si on doit verrouiller
  if (record.attempts >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    // Update Redis/Map with lockout
    const updatedInRedis = await setRedisRecord(key, record);
    if (!updatedInRedis) {
      loginAttempts.set(key, record);
    }

    // Log critique
    logger.warn('Security event: account locked', { event: 'account_locked', email: key, ipAddress, userAgent, lockoutDuration: LOCKOUT_DURATION_MS });

    // TODO (SEC-L05): Send brute-force lockout email notification to the user.
    // The email should include: the locked email address, the IP that triggered
    // the lockout, the lockout duration, and a link to reset password.
    // Implementation: create sendAccountLockedNotification() in lib/email.ts
    // await sendAccountLockedNotification(email, ipAddress, LOCKOUT_DURATION_MS);

    return {
      locked: true,
      attemptsRemaining: 0,
    };
  }

  return {
    locked: false,
    attemptsRemaining: MAX_FAILED_ATTEMPTS - record.attempts,
  };
}

/**
 * Réinitialise les tentatives après une connexion réussie
 */
// FAILLE-045 FIX: Make async to properly await Redis cleanup
export async function clearFailedAttempts(email: string): Promise<void> {
  const key = email.toLowerCase();
  loginAttempts.delete(key);
  await deleteRedisRecord(key).catch(() => {});
}

/**
 * Vérifie et enregistre une tentative de connexion
 * Retourne une erreur si le compte est verrouillé
 */
export async function checkLoginAttempt(
  email: string,
  _ipAddress: string,
  _userAgent: string
): Promise<{ allowed: boolean; message?: string }> {
  const { locked, remainingTime } = await isAccountLocked(email);

  if (locked) {
    // FAILLE-041 FIX: Use generic message that doesn't reveal account existence
    return {
      allowed: false,
      message: 'Identifiants invalides ou compte temporairement verrouillé.',
    };
  }

  return { allowed: true };
}

/**
 * Middleware pour vérifier le rate limit des connexions
 */
export async function loginRateLimitMiddleware(
  email: string,
  ipAddress: string,
  userAgent: string,
  success: boolean
): Promise<{ allowed: boolean; error?: string }> {
  // Vérifier si le compte est déjà verrouillé
  const lockStatus = await isAccountLocked(email);
  
  if (lockStatus.locked) {
    const minutes = Math.ceil(lockStatus.remainingTime / 60000);
    return {
      allowed: false,
      error: `Trop de tentatives échouées. Compte verrouillé pour ${minutes} minute(s).`,
    };
  }

  // Si connexion échouée, enregistrer la tentative
  if (!success) {
    const result = await recordFailedAttempt(email, ipAddress, userAgent);
    
    if (result.locked) {
      return {
        allowed: false,
        error: `Compte verrouillé après ${MAX_FAILED_ATTEMPTS} tentatives échouées. Réessayez dans 30 minutes.`,
      };
    }

    return {
      allowed: true,
      error: `Identifiants invalides. ${result.attemptsRemaining} tentative(s) restante(s).`,
    };
  }

  // Connexion réussie: réinitialiser les tentatives
  clearFailedAttempts(email);
  return { allowed: true };
}

// ============================================
// NETTOYAGE PÉRIODIQUE (FAILLE-007: single interval only)
// ============================================

/**
 * Nettoie les entrées expirées du cache
 */
export function cleanupExpiredAttempts(): void {
  const now = Date.now();

  for (const [key, record] of loginAttempts.entries()) {
    const isExpired = now - record.firstAttempt > ATTEMPT_WINDOW_MS;
    const lockoutExpired = record.lockedUntil && record.lockedUntil < now;

    if (isExpired || lockoutExpired) {
      loginAttempts.delete(key);
    }
  }

  // FAILLE-005: Also enforce size limit during cleanup
  enforceMapSizeLimit();
}

// FAILLE-007: Single cleanup interval (5 minutes) with typeof guard
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredAttempts, 5 * 60 * 1000);
}
