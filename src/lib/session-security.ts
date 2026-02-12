/**
 * SÉCURITÉ DES SESSIONS - Conforme NYDFS 23 NYCRR 500
 * Timeout d'inactivité, rotation des tokens, détection d'anomalies
 */

import { prisma } from './db';
import { createSecurityLog } from './security';

// Configuration conforme NYDFS
const SESSION_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes (requis NYDFS)
const SESSION_ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 heures max
const TOKEN_ROTATION_INTERVAL_MS = 60 * 60 * 1000; // Rotation toutes les heures

// Cache des dernières activités (en production, utiliser Redis)
const lastActivityCache = new Map<string, number>();
const sessionCreationCache = new Map<string, number>();

/**
 * Enregistre l'activité d'un utilisateur
 */
export function recordUserActivity(sessionId: string): void {
  lastActivityCache.set(sessionId, Date.now());
}

/**
 * Enregistre la création d'une session
 */
export function recordSessionCreation(sessionId: string): void {
  const now = Date.now();
  sessionCreationCache.set(sessionId, now);
  lastActivityCache.set(sessionId, now);
}

/**
 * Vérifie si une session est valide (timeout d'inactivité + absolu)
 */
export function isSessionValid(sessionId: string): {
  valid: boolean;
  reason?: 'inactivity' | 'absolute' | 'not_found';
} {
  const now = Date.now();

  // Vérifier si la session existe
  const lastActivity = lastActivityCache.get(sessionId);
  const creationTime = sessionCreationCache.get(sessionId);

  if (!lastActivity || !creationTime) {
    return { valid: false, reason: 'not_found' };
  }

  // Vérifier le timeout absolu (8h max)
  if (now - creationTime > SESSION_ABSOLUTE_TIMEOUT_MS) {
    invalidateSession(sessionId);
    return { valid: false, reason: 'absolute' };
  }

  // Vérifier le timeout d'inactivité (15 min)
  if (now - lastActivity > SESSION_INACTIVITY_TIMEOUT_MS) {
    invalidateSession(sessionId);
    return { valid: false, reason: 'inactivity' };
  }

  return { valid: true };
}

/**
 * Invalide une session
 */
export function invalidateSession(sessionId: string): void {
  lastActivityCache.delete(sessionId);
  sessionCreationCache.delete(sessionId);
}

/**
 * Vérifie si le token doit être roté
 */
export function shouldRotateToken(sessionId: string): boolean {
  const lastActivity = lastActivityCache.get(sessionId);
  if (!lastActivity) return false;

  const now = Date.now();
  return now - lastActivity > TOKEN_ROTATION_INTERVAL_MS;
}

// ============================================
// DÉTECTION D'ANOMALIES
// ============================================

interface SessionMetadata {
  userAgent: string;
  ipAddress: string;
  country?: string;
  device?: string;
}

const sessionMetadataCache = new Map<string, SessionMetadata>();

/**
 * Enregistre les métadonnées d'une session
 */
export function recordSessionMetadata(
  sessionId: string,
  metadata: SessionMetadata
): void {
  sessionMetadataCache.set(sessionId, metadata);
}

/**
 * Détecte les anomalies de session (changement d'IP, user agent, etc.)
 */
export async function detectSessionAnomaly(
  sessionId: string,
  currentMetadata: SessionMetadata
): Promise<{
  anomaly: boolean;
  type?: 'ip_change' | 'user_agent_change' | 'country_change';
}> {
  const storedMetadata = sessionMetadataCache.get(sessionId);

  if (!storedMetadata) {
    return { anomaly: false };
  }

  // Changement d'IP
  if (storedMetadata.ipAddress !== currentMetadata.ipAddress) {
    console.log(createSecurityLog('warn', 'session_ip_change', {
      sessionId,
      oldIp: storedMetadata.ipAddress,
      newIp: currentMetadata.ipAddress,
    }));
    return { anomaly: true, type: 'ip_change' };
  }

  // Changement de User-Agent
  if (storedMetadata.userAgent !== currentMetadata.userAgent) {
    console.log(createSecurityLog('warn', 'session_user_agent_change', {
      sessionId,
      oldUserAgent: storedMetadata.userAgent,
      newUserAgent: currentMetadata.userAgent,
    }));
    return { anomaly: true, type: 'user_agent_change' };
  }

  // Changement de pays
  if (storedMetadata.country && storedMetadata.country !== currentMetadata.country) {
    console.log(createSecurityLog('critical', 'session_country_change', {
      sessionId,
      oldCountry: storedMetadata.country,
      newCountry: currentMetadata.country,
    }));
    return { anomaly: true, type: 'country_change' };
  }

  return { anomaly: false };
}

// ============================================
// DÉCONNEXION DE TOUTES LES SESSIONS
// ============================================

/**
 * Invalide toutes les sessions d'un utilisateur
 * Utile en cas de changement de mot de passe ou compromission
 */
export async function invalidateAllUserSessions(userId: string): Promise<void> {
  // Supprimer toutes les sessions de la base de données
  await prisma.session.deleteMany({
    where: { userId },
  });

  // Log d'audit
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'LOGOUT_ALL',
      entityType: 'User',
      entityId: userId,
      details: JSON.stringify({
        reason: 'security_action',
        timestamp: new Date().toISOString(),
      }),
    },
  });

  console.log(createSecurityLog('info', 'all_sessions_invalidated', { userId }));
}

// ============================================
// MONITORING DES SESSIONS
// ============================================

/**
 * Retourne les sessions actives d'un utilisateur
 */
export async function getActiveSessions(userId: string): Promise<{
  id: string;
  createdAt: Date;
  lastActive: Date;
  ipAddress?: string;
  userAgent?: string;
}[]> {
  const sessions = await prisma.session.findMany({
    where: { userId },
    orderBy: { expires: 'desc' },
  });

  return sessions.map((session) => ({
    id: session.id,
    createdAt: session.expires, // Approximation
    lastActive: session.expires,
    // Note: IP et UserAgent doivent être stockés séparément si nécessaire
  }));
}

// ============================================
// LIMITATION DES SESSIONS CONCURRENTES
// ============================================

/**
 * Limite le nombre de sessions concurrentes par utilisateur.
 * Si le nombre de sessions existantes >= maxSessions, supprime les plus anciennes
 * pour ne garder que (maxSessions - 1) sessions, laissant de la place pour la nouvelle.
 *
 * Conforme NYDFS 23 NYCRR 500 - contrôle d'accès et audit.
 */
export async function enforceMaxSessions(
  userId: string,
  maxSessions: number = 3
): Promise<void> {
  try {
    // Count existing sessions for this user
    const existingSessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { expires: 'asc' }, // oldest first
      select: { id: true, expires: true },
    });

    if (existingSessions.length < maxSessions) {
      // Under the limit, nothing to do
      return;
    }

    // Calculate how many sessions to remove:
    // We need to bring the count down to (maxSessions - 1) to leave room for the new session
    const sessionsToRemove = existingSessions.length - (maxSessions - 1);
    const sessionsToDelete = existingSessions.slice(0, sessionsToRemove);
    const idsToDelete = sessionsToDelete.map((s) => s.id);

    // Delete the oldest sessions
    await prisma.session.deleteMany({
      where: {
        id: { in: idsToDelete },
      },
    });

    // Also clean up their in-memory caches
    for (const id of idsToDelete) {
      invalidateSession(id);
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'SESSION_LIMIT_ENFORCED',
        entityType: 'Session',
        entityId: userId,
        details: JSON.stringify({
          reason: 'max_concurrent_sessions_exceeded',
          maxSessions,
          existingCount: existingSessions.length,
          deletedCount: sessionsToRemove,
          deletedSessionIds: idsToDelete,
          timestamp: new Date().toISOString(),
        }),
      },
    });

    console.log(
      createSecurityLog('info', 'max_sessions_enforced', {
        userId,
        maxSessions,
        existingCount: existingSessions.length,
        deletedCount: sessionsToRemove,
      })
    );
  } catch (error) {
    // Resilient: log the error but do not block the login flow
    console.error(
      createSecurityLog('error', 'enforce_max_sessions_failed', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

// ============================================
// NETTOYAGE PÉRIODIQUE
// ============================================

export function cleanupExpiredSessions(): void {
  const now = Date.now();

  for (const [sessionId, lastActivity] of lastActivityCache.entries()) {
    if (now - lastActivity > SESSION_ABSOLUTE_TIMEOUT_MS) {
      invalidateSession(sessionId);
    }
  }
}

// Nettoyage toutes les 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredSessions, 5 * 60 * 1000);
}
