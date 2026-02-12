/**
 * PROTECTION BRUTE FORCE - Conforme NYDFS 23 NYCRR 500
 * Lockout après tentatives échouées + notification
 */

import { prisma } from './db';
import { createSecurityLog } from './security';

// Configuration
const MAX_FAILED_ATTEMPTS = 3;         // Nombre max de tentatives (Chubb: 3)
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes de lockout
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;   // Fenêtre de 15 minutes

// Cache en mémoire pour les performances
const loginAttempts = new Map<string, {
  attempts: number;
  firstAttempt: number;
  lockedUntil: number | null;
}>();

/**
 * Vérifie si un compte est verrouillé
 */
export async function isAccountLocked(email: string): Promise<{
  locked: boolean;
  remainingTime: number;
  attempts: number;
}> {
  const key = email.toLowerCase();
  const record = loginAttempts.get(key);
  const now = Date.now();

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

  let record = loginAttempts.get(key);

  // Nouvelle entrée ou fenêtre expirée
  if (!record || now - record.firstAttempt > ATTEMPT_WINDOW_MS) {
    record = {
      attempts: 1,
      firstAttempt: now,
      lockedUntil: null,
    };
    loginAttempts.set(key, record);
  } else {
    record.attempts++;
  }

  // Log de sécurité
  console.log(createSecurityLog('warn', 'failed_login_attempt', {
    email: key,
    ipAddress,
    userAgent,
    attemptNumber: record.attempts,
    maxAttempts: MAX_FAILED_ATTEMPTS,
  }));

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
  }).catch(() => {}); // Silently fail si pas de user

  // Vérifier si on doit verrouiller
  if (record.attempts >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;

    // Log critique
    console.log(createSecurityLog('critical', 'account_locked', {
      email: key,
      ipAddress,
      userAgent,
      lockoutDuration: LOCKOUT_DURATION_MS,
    }));

    // TODO: Envoyer une notification email à l'utilisateur
    // await sendAccountLockedNotification(email, ipAddress);

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
export function clearFailedAttempts(email: string): void {
  loginAttempts.delete(email.toLowerCase());
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
    const minutes = Math.ceil(remainingTime / 60000);
    return {
      allowed: false,
      message: `Compte temporairement verrouillé. Réessayez dans ${minutes} minute(s).`,
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
// NETTOYAGE PÉRIODIQUE
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
}

// Nettoyage toutes les 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredAttempts, 5 * 60 * 1000);
}
