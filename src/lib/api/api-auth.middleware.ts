/**
 * Public REST API Authentication Middleware
 *
 * Provides API key-based authentication for the public v1 API.
 * - API keys are stored as SHA-256 hashes (never in plaintext)
 * - Sliding window rate limiting with in-memory Map
 * - Per-key permission checking (e.g. "products:read", "orders:write")
 * - Automatic usage logging to ApiUsageLog table
 *
 * Usage:
 * ```ts
 * import { withApiAuth } from '@/lib/api/api-auth.middleware';
 *
 * export const GET = withApiAuth(async (request, { apiKey }) => {
 *   return NextResponse.json({ success: true, data: [...] });
 * }, 'products:read');
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ApiPermission =
  | 'products:read'
  | 'products:write'
  | 'orders:read'
  | 'orders:write'
  | 'invoices:read'
  | 'invoices:write'
  | 'customers:read'
  | 'customers:write'
  | 'inventory:read'
  | 'webhooks:read'
  | 'webhooks:write';

export const ALL_PERMISSIONS: ApiPermission[] = [
  'products:read',
  'products:write',
  'orders:read',
  'orders:write',
  'invoices:read',
  'invoices:write',
  'customers:read',
  'customers:write',
  'inventory:read',
  'webhooks:read',
  'webhooks:write',
];

interface ApiKeyContext {
  apiKeyId: string;
  apiKeyName: string;
  permissions: string[];
}

type ApiHandler = (
  request: NextRequest,
  context: { apiKey: ApiKeyContext; params?: Record<string, string> }
) => Promise<NextResponse | Response>;

// ---------------------------------------------------------------------------
// In-memory sliding window rate limiter
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupRateLimitMap(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  const oneHourAgo = now - 3600_000;
  for (const [key, entry] of rateLimitMap.entries()) {
    entry.timestamps = entry.timestamps.filter((ts) => ts > oneHourAgo);
    if (entry.timestamps.length === 0) {
      rateLimitMap.delete(key);
    }
  }

  // Hard cap to prevent unbounded memory growth
  if (rateLimitMap.size > 50_000) {
    const entries = Array.from(rateLimitMap.entries());
    entries.sort((a, b) => {
      const aLast = a[1].timestamps[a[1].timestamps.length - 1] || 0;
      const bLast = b[1].timestamps[b[1].timestamps.length - 1] || 0;
      return aLast - bLast;
    });
    const toRemove = entries.slice(0, entries.length - 25_000);
    for (const [key] of toRemove) {
      rateLimitMap.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function getClientIp(request: NextRequest): string {
  const raw =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip');
  if (raw && /^[\d.:a-fA-F]{3,45}$/.test(raw)) return raw;
  return '127.0.0.1';
}

function jsonSuccess(data: unknown, meta?: Record<string, unknown>, status = 200): NextResponse {
  const body: Record<string, unknown> = { success: true, data };
  if (meta) body.meta = meta;
  return NextResponse.json(body, { status });
}

function jsonError(message: string, status: number, headers?: Record<string, string>): NextResponse {
  const response = NextResponse.json({ success: false, error: message }, { status });
  if (headers) {
    Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
  }
  return response;
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Extract the API key from the Authorization header.
 * Expected format: "Bearer bp_live_xxxx..."
 */
export function extractApiKey(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;

  const key = parts[1].trim();
  if (!key || !key.startsWith('bp_live_')) return null;

  return key;
}

/**
 * Hash the raw key and look it up in the database.
 * Returns the ApiKey record if found, active, not expired, and not soft-deleted.
 */
export async function validateApiKey(rawKey: string) {
  const keyHash = hashKey(rawKey);

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
  });

  if (!apiKey) return null;
  if (!apiKey.isActive) return null;
  if (apiKey.deletedAt) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

  return apiKey;
}

/**
 * Check if the API key has the required permission.
 */
export function checkPermission(permissions: string, requiredPermission: ApiPermission): boolean {
  try {
    const perms: string[] = JSON.parse(permissions);
    // Wildcard "admin" grants everything
    if (perms.includes('*') || perms.includes('admin')) return true;

    // Direct match
    if (perms.includes(requiredPermission)) return true;

    // resource:* grants all actions on that resource
    const [resource] = requiredPermission.split(':');
    if (perms.includes(`${resource}:*`)) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Sliding window rate limiter. Checks if the key has exceeded its per-hour limit.
 * Returns { allowed, remaining, resetInMs }.
 */
export function checkRateLimit(
  apiKeyId: string,
  maxRequestsPerHour: number
): { allowed: boolean; remaining: number; resetInMs: number } {
  cleanupRateLimitMap();

  const now = Date.now();
  const windowMs = 3600_000; // 1 hour
  const windowStart = now - windowMs;

  let entry = rateLimitMap.get(apiKeyId);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitMap.set(apiKeyId, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

  if (entry.timestamps.length >= maxRequestsPerHour) {
    const oldestInWindow = entry.timestamps[0];
    const resetInMs = oldestInWindow + windowMs - now;
    return { allowed: false, remaining: 0, resetInMs: Math.max(resetInMs, 0) };
  }

  entry.timestamps.push(now);
  const remaining = maxRequestsPerHour - entry.timestamps.length;
  const resetInMs = entry.timestamps[0] + windowMs - now;

  return { allowed: true, remaining, resetInMs: Math.max(resetInMs, 0) };
}

/**
 * Log an API request to the ApiUsageLog table (fire-and-forget).
 */
export function logUsage(
  apiKeyId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  responseMs: number,
  ipAddress: string | null,
  userAgent: string | null
): void {
  // Fire-and-forget: do not await
  prisma.apiUsageLog
    .create({
      data: {
        apiKeyId,
        endpoint,
        method,
        statusCode,
        responseMs,
        ipAddress,
        userAgent,
      },
    })
    .then(() => {
      // Also update lastUsedAt on the key
      return prisma.apiKey.update({
        where: { id: apiKeyId },
        data: { lastUsedAt: new Date() },
      });
    })
    .catch((err) => {
      logger.error('Failed to log API usage', {
        event: 'api_usage_log_error',
        apiKeyId,
        endpoint,
        error: err instanceof Error ? err.message : String(err),
      });
    });
}

/**
 * Generate a new API key with a random token.
 * Returns { key, keyPrefix, keyHash } - the raw key should be shown once and never stored.
 */
export function generateApiKey(
  name: string,
  permissions: ApiPermission[],
  rateLimit = 1000
): { key: string; keyPrefix: string; keyHash: string; name: string; permissions: string; rateLimit: number } {
  const randomPart = randomBytes(32).toString('hex');
  const key = `bp_live_${randomPart}`;
  const keyPrefix = key.substring(0, 16); // "bp_live_" + 8 hex chars
  const keyHash = hashKey(key);

  return {
    key,
    keyPrefix,
    keyHash,
    name,
    permissions: JSON.stringify(permissions),
    rateLimit,
  };
}

// ---------------------------------------------------------------------------
// Higher-order function: withApiAuth
// ---------------------------------------------------------------------------

/**
 * Wrap a public API route handler with API key authentication, permission check,
 * rate limiting, and usage logging.
 *
 * @param handler - The actual route handler
 * @param requiredPermission - The permission required to access this endpoint
 */
export function withApiAuth(handler: ApiHandler, requiredPermission: ApiPermission) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (request: NextRequest, routeContext?: any): Promise<NextResponse> => {
    const startTime = Date.now();
    const endpoint = new URL(request.url).pathname;
    const method = request.method;
    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent');

    let apiKeyId = '';

    try {
      // 1. Extract API key
      const rawKey = extractApiKey(request);
      if (!rawKey) {
        return jsonError(
          'Missing or invalid API key. Use Authorization: Bearer bp_live_xxx',
          401,
          { 'WWW-Authenticate': 'Bearer' }
        );
      }

      // 2. Validate API key
      const apiKeyRecord = await validateApiKey(rawKey);
      if (!apiKeyRecord) {
        return jsonError('Invalid, expired, or revoked API key', 401);
      }

      apiKeyId = apiKeyRecord.id;

      // 3. Check permission
      if (!checkPermission(apiKeyRecord.permissions, requiredPermission)) {
        const responseMs = Date.now() - startTime;
        logUsage(apiKeyId, endpoint, method, 403, responseMs, ip, userAgent);
        return jsonError(
          `Insufficient permissions. Required: ${requiredPermission}`,
          403
        );
      }

      // 4. Rate limiting
      const rateResult = checkRateLimit(apiKeyId, apiKeyRecord.rateLimit);
      if (!rateResult.allowed) {
        const retryAfterSeconds = Math.ceil(rateResult.resetInMs / 1000);
        const responseMs = Date.now() - startTime;
        logUsage(apiKeyId, endpoint, method, 429, responseMs, ip, userAgent);
        return jsonError('Rate limit exceeded', 429, {
          'Retry-After': String(retryAfterSeconds),
          'X-RateLimit-Limit': String(apiKeyRecord.rateLimit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(retryAfterSeconds),
        });
      }

      // 5. Resolve route params
      let params: Record<string, string> | undefined;
      if (routeContext?.params) {
        params = await routeContext.params;
      }

      // 6. Execute handler
      const apiKeyContext: ApiKeyContext = {
        apiKeyId: apiKeyRecord.id,
        apiKeyName: apiKeyRecord.name,
        permissions: JSON.parse(apiKeyRecord.permissions),
      };

      const response = await handler(request, { apiKey: apiKeyContext, params });

      // 7. Add rate limit headers
      response.headers.set('X-RateLimit-Limit', String(apiKeyRecord.rateLimit));
      response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining));
      response.headers.set('X-RateLimit-Reset', String(Math.ceil(rateResult.resetInMs / 1000)));

      // 8. Log usage
      const responseMs = Date.now() - startTime;
      const statusCode = response instanceof NextResponse ? response.status : 200;
      logUsage(apiKeyId, endpoint, method, statusCode, responseMs, ip, userAgent);

      return response as NextResponse;
    } catch (error) {
      logger.error('Public API unhandled error', {
        event: 'public_api_error',
        endpoint,
        method,
        apiKeyId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      const responseMs = Date.now() - startTime;
      if (apiKeyId) {
        logUsage(apiKeyId, endpoint, method, 500, responseMs, ip, userAgent);
      }

      return jsonError('Internal server error', 500);
    }
  };
}

// ---------------------------------------------------------------------------
// Response helpers (exported for use in route handlers)
// ---------------------------------------------------------------------------

export { jsonSuccess, jsonError };
