/**
 * RATE LIMITER - Protection contre les abus API
 * Implémente sliding window rate limiting
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// Cache en mémoire (considérer Redis pour la production multi-serveur)
const rateLimitCache = new Map<string, RateLimitEntry>();

// Configuration par défaut
const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX_REQUESTS = 100;    // 100 requêtes par fenêtre

// Configurations spécifiques par endpoint
const RATE_LIMIT_CONFIGS: Record<string, { windowMs: number; maxRequests: number }> = {
  // Auth - plus strict
  'auth/login': { windowMs: 60000, maxRequests: 5 },
  'auth/register': { windowMs: 300000, maxRequests: 3 },
  'auth/forgot-password': { windowMs: 300000, maxRequests: 3 },
  'auth/reset-password': { windowMs: 300000, maxRequests: 5 },
  
  // API publiques - modéré
  'products': { windowMs: 60000, maxRequests: 60 },
  'categories': { windowMs: 60000, maxRequests: 60 },
  'search': { windowMs: 60000, maxRequests: 30 },
  
  // Checkout - strict
  'checkout': { windowMs: 60000, maxRequests: 10 },
  'payments': { windowMs: 60000, maxRequests: 10 },
  
  // Admin - modéré
  'admin': { windowMs: 60000, maxRequests: 100 },
  
  // Chat - permissif
  'chat': { windowMs: 60000, maxRequests: 120 },
};

/**
 * Génère une clé unique pour le rate limiting
 */
function generateRateLimitKey(ip: string, endpoint: string, userId?: string): string {
  const base = userId ? `user:${userId}` : `ip:${ip}`;
  return `ratelimit:${base}:${endpoint}`;
}

/**
 * Extrait le type d'endpoint pour la configuration
 */
function getEndpointType(path: string): string {
  const segments = path.split('/').filter(Boolean);
  
  // API routes
  if (segments[0] === 'api') {
    if (segments[1] === 'auth') return `auth/${segments[2] || 'default'}`;
    if (segments[1] === 'admin') return 'admin';
    if (segments[1] === 'checkout' || segments[1] === 'payments') return segments[1];
    if (segments[1] === 'chat') return 'chat';
    return segments[1] || 'default';
  }
  
  return 'default';
}

/**
 * Vérifie si une requête dépasse la limite de rate
 */
export function checkRateLimit(
  ip: string,
  path: string,
  userId?: string
): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
} {
  const endpointType = getEndpointType(path);
  const config = RATE_LIMIT_CONFIGS[endpointType] || {
    windowMs: DEFAULT_WINDOW_MS,
    maxRequests: DEFAULT_MAX_REQUESTS,
  };
  
  const key = generateRateLimitKey(ip, endpointType, userId);
  const now = Date.now();
  
  let entry = rateLimitCache.get(key);
  
  // Nouvelle entrée ou fenêtre expirée
  if (!entry || now - entry.windowStart >= config.windowMs) {
    entry = { count: 1, windowStart: now };
    rateLimitCache.set(key, entry);
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
      limit: config.maxRequests,
    };
  }
  
  // Incrémenter le compteur
  entry.count++;
  
  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);
  const resetAt = entry.windowStart + config.windowMs;
  
  return {
    allowed,
    remaining,
    resetAt,
    limit: config.maxRequests,
  };
}

/**
 * Middleware pour Next.js API routes
 */
export function rateLimitMiddleware(
  ip: string,
  path: string,
  userId?: string
): {
  success: boolean;
  headers: Record<string, string>;
  error?: { message: string; retryAfter: number };
} {
  const result = checkRateLimit(ip, path, userId);
  
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
  
  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    headers['Retry-After'] = String(retryAfter);
    
    return {
      success: false,
      headers,
      error: {
        message: 'Trop de requêtes. Veuillez réessayer plus tard.',
        retryAfter,
      },
    };
  }
  
  return { success: true, headers };
}

/**
 * Nettoie les entrées expirées du cache
 */
export function cleanupRateLimitCache(): void {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes max
  
  for (const [key, entry] of rateLimitCache.entries()) {
    if (now - entry.windowStart > maxAge) {
      rateLimitCache.delete(key);
    }
  }
}

// Nettoyage périodique (toutes les 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimitCache, 5 * 60 * 1000);
}

/**
 * Réinitialise le rate limit pour un utilisateur/IP spécifique
 * Utile pour les admins ou après un captcha réussi
 */
export function resetRateLimit(ip: string, path: string, userId?: string): void {
  const endpointType = getEndpointType(path);
  const key = generateRateLimitKey(ip, endpointType, userId);
  rateLimitCache.delete(key);
}

/**
 * Obtient les statistiques actuelles de rate limiting
 */
export function getRateLimitStats(): {
  totalEntries: number;
  entriesByEndpoint: Record<string, number>;
} {
  const stats: Record<string, number> = {};
  
  for (const key of rateLimitCache.keys()) {
    const endpoint = key.split(':')[2] || 'unknown';
    stats[endpoint] = (stats[endpoint] || 0) + 1;
  }
  
  return {
    totalEntries: rateLimitCache.size,
    entriesByEndpoint: stats,
  };
}
