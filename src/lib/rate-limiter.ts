/**
 * RATE LIMITER - Protection contre les abus API
 * Redis-backed sliding window rate limiting with in-memory fallback
 *
 * Strategy:
 *   1. Try to connect to Redis (via ioredis) using REDIS_URL env var.
 *   2. If Redis is unavailable or ioredis is not installed, fall back
 *      to the in-memory Map implementation transparently.
 *   3. Uses Redis INCR + EXPIRE for atomic fixed-window counting.
 *   4. Key pattern: rl:{ip_or_user}:{endpoint} with TTL = windowMs.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Redis client abstraction
// ---------------------------------------------------------------------------

/**
 * Minimal Redis interface we need -- allows swapping ioredis / node-redis / etc.
 * We only rely on INCR, EXPIRE, TTL, DEL and KEYS.
 */
interface RedisClient {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  status?: string;
  quit(): Promise<string>;
}

let redisClient: RedisClient | null = null;
let redisAvailable = false;
let redisInitAttempted = false;

/**
 * Attempt to lazily initialise a Redis connection.
 * Safe to call multiple times -- only the first call does real work.
 */
async function getRedisClient(): Promise<RedisClient | null> {
  if (redisInitAttempted) return redisClient;
  redisInitAttempted = true;

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn(
      '[rate-limiter] REDIS_URL not set -- using in-memory fallback'
    );
    return null;
  }

  try {
    // Dynamic import so the app doesn't crash if ioredis is not installed
    const Redis = (await import('ioredis')).default;
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
      enableReadyCheck: true,
      retryStrategy(times: number) {
        // Stop retrying after 3 attempts -- we will fall back to in-memory
        if (times > 3) return null;
        return Math.min(times * 200, 1000);
      },
    });

    // Attempt to connect
    await client.connect();
    redisClient = client as unknown as RedisClient;
    redisAvailable = true;
    console.info('[rate-limiter] Redis connected successfully');

    // If the connection drops later, flag as unavailable
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Redis client event emitter not typed
    (client as any).on('error', (err: Error) => {
      console.error('[rate-limiter] Redis error:', err.message);
      redisAvailable = false;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Redis client event emitter not typed
    (client as any).on('connect', () => {
      redisAvailable = true;
    });

    return redisClient;
  } catch (err) {
    // ioredis not installed OR connection failed
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[rate-limiter] Redis unavailable (${message}) -- using in-memory fallback`
    );
    return null;
  }
}

// Kick off the initialisation on module load (non-blocking)
if (typeof process !== 'undefined' && process.env) {
  getRedisClient().catch(() => {
    /* swallow -- fallback is fine */
  });
}

// ---------------------------------------------------------------------------
// In-memory fallback store
// ---------------------------------------------------------------------------

const rateLimitCache = new Map<string, RateLimitEntry>();

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX_REQUESTS = 100;    // 100 requests per window

const RATE_LIMIT_CONFIGS: Record<string, { windowMs: number; maxRequests: number }> = {
  // Auth - plus strict
  'auth/login': { windowMs: 60000, maxRequests: 5 },
  'auth/register': { windowMs: 300000, maxRequests: 3 },
  'auth/forgot-password': { windowMs: 300000, maxRequests: 3 },
  'auth/reset-password': { windowMs: 300000, maxRequests: 5 },

  // API publiques - modere
  'products': { windowMs: 60000, maxRequests: 60 },
  'categories': { windowMs: 60000, maxRequests: 60 },
  'search': { windowMs: 60000, maxRequests: 30 },

  // Checkout - strict
  'checkout': { windowMs: 60000, maxRequests: 10 },
  'payments': { windowMs: 60000, maxRequests: 10 },

  // Admin - modere
  'admin': { windowMs: 60000, maxRequests: 100 },

  // Chat - permissif (general)
  'chat': { windowMs: 60000, maxRequests: 120 },

  // BE-SEC-01: Contact form - 3 per IP per hour (anti-spam)
  'contact': { windowMs: 3600000, maxRequests: 3 },

  // BE-SEC-01: Newsletter subscribe - 5 per IP per hour
  'newsletter': { windowMs: 3600000, maxRequests: 5 },

  // BE-SEC-01: Review submission - 10 per user per day
  'reviews': { windowMs: 86400000, maxRequests: 10 },

  // BE-SEC-02: Promo code validation - 10 per IP per hour (anti brute-force enumeration)
  'promo/validate': { windowMs: 3600000, maxRequests: 10 },

  // BE-SEC-14: Chat message - 20 per user per hour (prevents OpenAI cost explosion)
  'chat/message': { windowMs: 3600000, maxRequests: 20 },

  // SEC-19: Gift card balance check - 5 per IP per minute
  'gift-cards/balance': { windowMs: 60000, maxRequests: 5 },

  // SEC-18: Order tracking - 10 per IP per minute
  'orders/track': { windowMs: 60000, maxRequests: 10 },

  // SEC-24: Stock alerts - 10 per IP per hour
  'stock-alerts': { windowMs: 3600000, maxRequests: 10 },

  // SEC-25: Chat route - 10 per user per hour
  'chat/route': { windowMs: 3600000, maxRequests: 10 },

  // SEC-27: Password change - 5 per user per hour
  'account/password': { windowMs: 3600000, maxRequests: 5 },
};

// ---------------------------------------------------------------------------
// Key generation
// ---------------------------------------------------------------------------

/** Redis key prefix */
const REDIS_KEY_PREFIX = 'rl';

/**
 * Generates a unique rate-limit key.
 * Pattern: rl:{ip_or_user}:{endpoint}
 */
function generateRateLimitKey(ip: string, endpoint: string, userId?: string): string {
  const identity = userId ? `user_${userId}` : `ip_${ip}`;
  return `${REDIS_KEY_PREFIX}:${identity}:${endpoint}`;
}

// ---------------------------------------------------------------------------
// Endpoint type resolution
// ---------------------------------------------------------------------------

function getEndpointType(path: string): string {
  const segments = path.split('/').filter(Boolean);

  if (segments[0] === 'api') {
    if (segments[1] === 'auth') return `auth/${segments[2] || 'default'}`;
    if (segments[1] === 'admin') return 'admin';
    if (segments[1] === 'checkout' || segments[1] === 'payments') return segments[1];
    // Chat: distinguish /api/chat/message from /api/chat
    if (segments[1] === 'chat' && segments[2] === 'message') return 'chat/message';
    if (segments[1] === 'chat' && segments[2] === 'route') return 'chat/route';
    if (segments[1] === 'chat') return 'chat';
    // Promo: distinguish /api/promo/validate
    if (segments[1] === 'promo' && segments[2] === 'validate') return 'promo/validate';
    // Gift cards: distinguish /api/gift-cards/balance
    if (segments[1] === 'gift-cards' && segments[2] === 'balance') return 'gift-cards/balance';
    // Orders: distinguish /api/orders/track
    if (segments[1] === 'orders' && segments[2] === 'track') return 'orders/track';
    // Stock alerts
    if (segments[1] === 'stock-alerts') return 'stock-alerts';
    // Account: distinguish /api/account/password
    if (segments[1] === 'account' && segments[2] === 'password') return 'account/password';
    return segments[1] || 'default';
  }

  return 'default';
}

// ---------------------------------------------------------------------------
// Core: Redis-backed check
// ---------------------------------------------------------------------------

async function checkRateLimitRedis(
  key: string,
  config: { windowMs: number; maxRequests: number }
): Promise<RateLimitResult> {
  const client = redisClient!;
  const ttlSeconds = Math.ceil(config.windowMs / 1000);

  // INCR is atomic -- creates the key with value 1 if it does not exist
  const count = await client.incr(key);

  if (count === 1) {
    // First request in this window -- set the TTL
    await client.expire(key, ttlSeconds);
  }

  // Determine when the window resets
  const remainingTtl = await client.ttl(key);
  // TTL returns -1 if no expiry set (shouldn't happen but guard)
  const effectiveTtl = remainingTtl > 0 ? remainingTtl : ttlSeconds;
  const resetAt = Date.now() + effectiveTtl * 1000;

  const allowed = count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - count);

  return { allowed, remaining, resetAt, limit: config.maxRequests };
}

// ---------------------------------------------------------------------------
// Core: In-memory fallback check
// ---------------------------------------------------------------------------

function checkRateLimitMemory(
  key: string,
  config: { windowMs: number; maxRequests: number }
): RateLimitResult {
  const now = Date.now();
  let entry = rateLimitCache.get(key);

  // New entry or expired window
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

  entry.count++;

  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);
  const resetAt = entry.windowStart + config.windowMs;

  return { allowed, remaining, resetAt, limit: config.maxRequests };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check rate limit for a request.
 * Tries Redis first, falls back to in-memory Map if Redis is unavailable.
 */
export async function checkRateLimit(
  ip: string,
  path: string,
  userId?: string
): Promise<RateLimitResult> {
  const endpointType = getEndpointType(path);
  const config = RATE_LIMIT_CONFIGS[endpointType] || {
    windowMs: DEFAULT_WINDOW_MS,
    maxRequests: DEFAULT_MAX_REQUESTS,
  };
  const key = generateRateLimitKey(ip, endpointType, userId);

  // Try Redis
  if (redisAvailable && redisClient) {
    try {
      return await checkRateLimitRedis(key, config);
    } catch (err) {
      // Redis call failed -- degrade gracefully
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[rate-limiter] Redis call failed (${message}), falling back to memory`);
      redisAvailable = false;
    }
  }

  // Fallback: in-memory
  return checkRateLimitMemory(key, config);
}

/**
 * Synchronous rate limit check -- always uses in-memory store.
 * Provided for backward-compatibility with callers that cannot await.
 */
export function checkRateLimitSync(
  ip: string,
  path: string,
  userId?: string
): RateLimitResult {
  const endpointType = getEndpointType(path);
  const config = RATE_LIMIT_CONFIGS[endpointType] || {
    windowMs: DEFAULT_WINDOW_MS,
    maxRequests: DEFAULT_MAX_REQUESTS,
  };
  const key = generateRateLimitKey(ip, endpointType, userId);
  return checkRateLimitMemory(key, config);
}

/**
 * Middleware for Next.js API routes.
 * Returns rate-limit headers and optional error payload.
 */
export async function rateLimitMiddleware(
  ip: string,
  path: string,
  userId?: string
): Promise<{
  success: boolean;
  headers: Record<string, string>;
  error?: { message: string; retryAfter: number };
}> {
  const result = await checkRateLimit(ip, path, userId);

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

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Cleans expired entries from the in-memory fallback cache.
 * When Redis is used the TTL takes care of expiry automatically.
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

// Periodic in-memory cleanup (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimitCache, 5 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

/**
 * Resets the rate limit for a specific user/IP and path.
 * Useful after a successful captcha or admin action.
 */
export async function resetRateLimit(
  ip: string,
  path: string,
  userId?: string
): Promise<void> {
  const endpointType = getEndpointType(path);
  const key = generateRateLimitKey(ip, endpointType, userId);

  // Remove from in-memory cache
  rateLimitCache.delete(key);

  // Remove from Redis
  if (redisAvailable && redisClient) {
    try {
      await redisClient.del(key);
    } catch {
      // Non-critical -- the key will expire via TTL anyway
    }
  }
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/**
 * Returns current rate-limiting statistics.
 * When Redis is the backend, in-memory stats will be empty (which is expected).
 */
export async function getRateLimitStats(): Promise<{
  totalEntries: number;
  entriesByEndpoint: Record<string, number>;
  backend: 'redis' | 'memory';
}> {
  // Try Redis first
  if (redisAvailable && redisClient) {
    try {
      const keys = await redisClient.keys(`${REDIS_KEY_PREFIX}:*`);
      const stats: Record<string, number> = {};

      for (const key of keys) {
        // Key format: rl:{identity}:{endpoint}
        const parts = key.split(':');
        const endpoint = parts.slice(2).join(':') || 'unknown';
        stats[endpoint] = (stats[endpoint] || 0) + 1;
      }

      return {
        totalEntries: keys.length,
        entriesByEndpoint: stats,
        backend: 'redis',
      };
    } catch {
      // Fall through to memory stats
    }
  }

  // In-memory stats
  const stats: Record<string, number> = {};

  for (const key of rateLimitCache.keys()) {
    // Key format: rl:{identity}:{endpoint}
    const parts = key.split(':');
    const endpoint = parts.slice(2).join(':') || 'unknown';
    stats[endpoint] = (stats[endpoint] || 0) + 1;
  }

  return {
    totalEntries: rateLimitCache.size,
    entriesByEndpoint: stats,
    backend: 'memory',
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Returns true if the rate limiter is currently backed by Redis.
 */
export function isRedisBackend(): boolean {
  return redisAvailable && redisClient !== null;
}

/**
 * Exported for tests or external tooling -- the full config map.
 */
export { RATE_LIMIT_CONFIGS };
