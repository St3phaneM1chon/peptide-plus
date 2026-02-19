/**
 * REDIS CLIENT - Shared singleton for the application
 *
 * Used by: cache.ts, cron-lock.ts, job-queue.ts, rate-limiter.ts
 * Falls back gracefully when REDIS_URL is not set.
 */

import { logger } from '@/lib/logger';

interface MinimalRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: (string | number)[]): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  scan(cursor: string | number, ...args: (string | number)[]): Promise<[string, string[]]>;
  ttl(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  lpush(key: string, ...values: string[]): Promise<number>;
  brpop(key: string, timeout: number): Promise<[string, string] | null>;
  rpop(key: string): Promise<string | null>;
  llen(key: string): Promise<number>;
  hset(key: string, ...args: (string | number)[]): Promise<number>;
  hget(key: string, field: string): Promise<string | null>;
  hgetall(key: string): Promise<Record<string, string>>;
  hincrby(key: string, field: string, increment: number): Promise<number>;
  setnx(key: string, value: string): Promise<number>;
  status?: string;
  quit(): Promise<string>;
}

let _client: MinimalRedisClient | null = null;
let _initAttempted = false;
let _available = false;

/**
 * Get the shared Redis client.
 * Returns null if REDIS_URL is not set or connection failed.
 */
export async function getRedisClient(): Promise<MinimalRedisClient | null> {
  if (_initAttempted) return _client;
  _initAttempted = true;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.debug('[redis] REDIS_URL not set -- Redis unavailable');
    return null;
  }

  try {
    const Redis = (await import('ioredis')).default;
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
      enableReadyCheck: true,
      retryStrategy(times: number) {
        if (times > 3) return null;
        return Math.min(times * 200, 1000);
      },
    });

    await client.connect();
    _client = client as unknown as MinimalRedisClient;
    _available = true;
    logger.info('[redis] Connected successfully');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).on('error', (err: Error) => {
      logger.error('[redis] Connection error:', { error: err.message });
      _available = false;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).on('connect', () => {
      _available = true;
    });

    return _client;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`[redis] Unavailable (${message})`);
    return null;
  }
}

/** Check if Redis is currently connected and available */
export function isRedisAvailable(): boolean {
  return _available && _client !== null;
}

/** Get the raw client (may be null) */
export function getRedisClientSync(): MinimalRedisClient | null {
  return _client;
}

// Kick off connection on module load
if (typeof process !== 'undefined' && process.env) {
  getRedisClient().catch(() => {});
}

export type { MinimalRedisClient };
