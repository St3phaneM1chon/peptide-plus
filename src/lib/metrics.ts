/**
 * BUSINESS METRICS COLLECTION
 *
 * Tracks business metrics (counters, histograms) for operational visibility.
 * Stores in Redis when available, falls back to in-memory storage.
 *
 * Metrics tracked:
 *   - orders_created, payments_processed, emails_sent
 *   - api_errors, cache_hits, cache_misses
 *
 * Usage:
 *   import { incrementCounter, recordHistogram, getMetricsSummary } from '@/lib/metrics';
 *
 *   incrementCounter('orders_created', { status: 'completed' });
 *   recordHistogram('api.response_time', 245);
 */

import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CounterEntry {
  value: number;
  tags: Record<string, string>;
  updatedAt: number;
}

interface HistogramEntry {
  values: number[];
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// In-memory storage (with Redis TTL emulation)
// ---------------------------------------------------------------------------

const counters = new Map<string, CounterEntry>();
const histograms = new Map<string, HistogramEntry>();

/** TTL for metrics: 24 hours */
const METRICS_TTL_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Redis helpers (optional)
// ---------------------------------------------------------------------------

let redisClient: { incr: (key: string) => Promise<number>; expire: (key: string, seconds: number) => Promise<number>; get: (key: string) => Promise<string | null>; keys: (pattern: string) => Promise<string[]> } | null = null;
let redisChecked = false;

async function getRedis() {
  if (redisChecked) return redisClient;
  redisChecked = true;

  if (!process.env.REDIS_URL) return null;

  try {
    const Redis = (await import('ioredis')).default;
    const client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
    });
    await client.connect();
    redisClient = client as unknown as typeof redisClient;
    return redisClient;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Counter operations
// ---------------------------------------------------------------------------

/**
 * Increment a named counter by 1.
 *
 * @param name - Counter name (e.g. 'orders_created', 'payments_processed')
 * @param tags - Optional key-value tags for filtering (e.g. { status: 'completed' })
 */
export function incrementCounter(
  name: string,
  tags?: Record<string, string>,
): void {
  const tagStr = tags ? Object.entries(tags).map(([k, v]) => `${k}:${v}`).join(',') : '';
  const key = tagStr ? `${name}:{${tagStr}}` : name;

  // In-memory
  const existing = counters.get(key);
  if (existing) {
    existing.value++;
    existing.updatedAt = Date.now();
  } else {
    counters.set(key, { value: 1, tags: tags || {}, updatedAt: Date.now() });
  }

  // Async Redis (fire and forget)
  getRedis().then((redis) => {
    if (redis) {
      const redisKey = `metrics:counter:${key}`;
      redis.incr(redisKey).catch(() => {});
      redis.expire(redisKey, Math.ceil(METRICS_TTL_MS / 1000)).catch(() => {});
    }
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Histogram operations
// ---------------------------------------------------------------------------

/**
 * Record a value in a histogram (for percentile calculations).
 *
 * @param name - Histogram name (e.g. 'api.response_time')
 * @param value - Numeric value to record
 */
export function recordHistogram(
  name: string,
  value: number,
): void {
  const existing = histograms.get(name);
  if (existing) {
    // Keep last 1000 values to avoid memory bloat
    if (existing.values.length >= 1000) {
      existing.values.shift();
    }
    existing.values.push(value);
    existing.updatedAt = Date.now();
  } else {
    histograms.set(name, { values: [value], updatedAt: Date.now() });
  }
}

// ---------------------------------------------------------------------------
// Metrics summary
// ---------------------------------------------------------------------------

/**
 * Get a summary of all collected metrics.
 * Used by the admin metrics endpoint.
 */
export function getMetricsSummary(): {
  counters: Record<string, { value: number; tags: Record<string, string> }>;
  histograms: Record<string, { count: number; min: number; max: number; avg: number; p95: number; p99: number }>;
  collectedSince: number;
} {
  const now = Date.now();

  // Clean expired entries
  for (const [key, entry] of counters.entries()) {
    if (now - entry.updatedAt > METRICS_TTL_MS) {
      counters.delete(key);
    }
  }
  for (const [key, entry] of histograms.entries()) {
    if (now - entry.updatedAt > METRICS_TTL_MS) {
      histograms.delete(key);
    }
  }

  // Build counters summary
  const countersSummary: Record<string, { value: number; tags: Record<string, string> }> = {};
  for (const [key, entry] of counters.entries()) {
    countersSummary[key] = { value: entry.value, tags: entry.tags };
  }

  // Build histograms summary
  const histogramsSummary: Record<string, { count: number; min: number; max: number; avg: number; p95: number; p99: number }> = {};
  for (const [key, entry] of histograms.entries()) {
    const sorted = [...entry.values].sort((a, b) => a - b);
    const count = sorted.length;
    histogramsSummary[key] = {
      count,
      min: sorted[0] ?? 0,
      max: sorted[count - 1] ?? 0,
      avg: Math.round((sorted.reduce((sum, v) => sum + v, 0) / count) * 100) / 100,
      p95: sorted[Math.floor(count * 0.95)] ?? 0,
      p99: sorted[Math.floor(count * 0.99)] ?? 0,
    };
  }

  // Find oldest metric timestamp
  let oldest = now;
  for (const entry of counters.values()) {
    if (entry.updatedAt < oldest) oldest = entry.updatedAt;
  }
  for (const entry of histograms.values()) {
    if (entry.updatedAt < oldest) oldest = entry.updatedAt;
  }

  return {
    counters: countersSummary,
    histograms: histogramsSummary,
    collectedSince: oldest,
  };
}

/**
 * Reset all metrics (useful for testing).
 */
export function resetMetrics(): void {
  counters.clear();
  histograms.clear();
}

// Log initialization
logger.debug('Business metrics collector initialized');
