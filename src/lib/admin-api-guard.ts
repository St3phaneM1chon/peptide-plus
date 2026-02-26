/**
 * Admin API Guard - Centralized security for all admin API routes.
 * Enforces: Authentication + Role check + CSRF + Rate Limiting
 *
 * Usage:
 * ```ts
 * import { withAdminGuard } from '@/lib/admin-api-guard';
 *
 * export const GET = withAdminGuard(async (request, { session }) => {
 *   return NextResponse.json({ data: '...' });
 * });
 *
 * export const POST = withAdminGuard(async (request, { session }) => {
 *   const body = await request.json();
 *   return NextResponse.json({ created: true }, { status: 201 });
 * });
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { validateCsrf } from '@/lib/csrf-middleware';
import { checkRateLimit as checkRateLimitMemory } from '@/lib/security';
// FAILLE-009 FIX: Import Redis-backed rate limiter for persistent rate limiting across deploys
import { checkRateLimit as checkRateLimitRedis } from '@/lib/rate-limiter';
import { UserRole } from '@/types';
import { logger } from '@/lib/logger';
import { hasPermission, type PermissionCode } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AdminHandler = (
  request: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Handlers use various session/params shapes; runtime coercion is safe.
  context: any
) => Promise<NextResponse | Response>;

export interface AdminGuardOptions {
  /** Skip CSRF validation for this route (e.g. GET-only endpoints). Default: false */
  skipCsrf?: boolean;
  /** Override rate limit (requests per minute). Default: 60 for reads, 30 for writes */
  rateLimit?: number;
  /** If set, check that the user has this specific permission (via hasPermission from permissions.ts) */
  requiredPermission?: PermissionCode;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** HTTP methods considered as mutations (require CSRF protection) */
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// FAILLE-009 FIX: Rate limits per minute for admin API routes.
// Now uses Redis-backed checkRateLimit from rate-limiter.ts (persistent across deploys/restarts),
// with in-memory fallback from security.ts if Redis is unavailable.
// Reads: 100 req/min per IP+route -- matches the general admin config in rate-limiter.ts
// Writes: 30 req/min per IP+route -- intentionally stricter for mutation methods (POST/PUT/PATCH/DELETE)
const RATE_LIMIT_READ = 100;
const RATE_LIMIT_WRITE = 30;

/** Rate limit window in milliseconds (1 minute) */
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

/** Roles allowed to access admin API routes */
const ADMIN_ROLES = new Set<string>([UserRole.EMPLOYEE, UserRole.OWNER]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// FAILLE-055 FIX: Validate IP format to prevent spoofed/malicious values
function getClientIp(request: NextRequest): string {
  const raw =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip');
  // Accept only valid IPv4/IPv6 patterns (3-45 chars, hex digits, dots, colons)
  if (raw && /^[\d.:a-fA-F]{3,45}$/.test(raw)) return raw;
  return '127.0.0.1';
}

function jsonError(message: string, status: number, headers?: Record<string, string>): NextResponse {
  const response = NextResponse.json({ error: message, status }, { status });
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
  }
  return response;
}

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------

/**
 * Wraps an admin API route handler with layered security checks.
 *
 * Order of checks:
 * 1. Authentication - session must exist (401 if not)
 * 2. Authorization  - role must be EMPLOYEE or OWNER (403 if not)
 * 3. CSRF           - mutations require valid CSRF token (403 if invalid)
 * 4. Rate Limiting  - IP + route key, 60/min reads, 30/min writes (429 if exceeded)
 * 5. Handler        - the actual route logic receives the validated session
 */
export function withAdminGuard(
  handler: AdminHandler,
  options?: AdminGuardOptions
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Second param typed as `any` so Next.js 15
  // .next/types ParamCheck accepts this handler for both dynamic ([id]) and non-dynamic routes.
  return async (request: NextRequest, routeContext?: any): Promise<NextResponse> => {
    try {
      // ---------------------------------------------------------------
      // 1. Authentication
      // ---------------------------------------------------------------
      const session = await auth();

      if (!session?.user) {
        return jsonError('Unauthorized', 401);
      }

      // ---------------------------------------------------------------
      // 1b. FIX: FAILLE-066 - Reject oversized JSON bodies (max 1MB)
      // ---------------------------------------------------------------
      const contentLength = request.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > 1_048_576) {
        return jsonError('Request body too large', 413);
      }

      // ---------------------------------------------------------------
      // 2. Role check - only EMPLOYEE and OWNER can access admin APIs
      // ---------------------------------------------------------------
      const userRole = session.user.role as string;

      if (!ADMIN_ROLES.has(userRole)) {
        logger.warn('Admin access denied', {
          event: 'admin_access_denied',
          userId: session.user.id,
          role: userRole,
          path: new URL(request.url).pathname,
          method: request.method,
        });
        return jsonError('Forbidden', 403);
      }

      // ---------------------------------------------------------------
      // 2b. Granular permission check (FAILLE-002)
      // ---------------------------------------------------------------
      if (options?.requiredPermission) {
        const hasPerm = await hasPermission(session.user.id, userRole as UserRole, options.requiredPermission);
        if (!hasPerm) {
          logger.warn('Admin permission denied', {
            event: 'admin_permission_denied',
            userId: session.user.id,
            role: userRole,
            requiredPermission: options.requiredPermission,
            path: new URL(request.url).pathname,
          });
          return jsonError('Insufficient permissions', 403);
        }
      }

      // ---------------------------------------------------------------
      // 3. CSRF validation for mutation methods
      // ---------------------------------------------------------------
      const isMutation = MUTATION_METHODS.has(request.method.toUpperCase());

      if (isMutation && !options?.skipCsrf) {
        const csrfValid = await validateCsrf(request);

        if (!csrfValid) {
          logger.warn('CSRF validation failed', {
            event: 'csrf_validation_failed',
            userId: session.user.id,
            path: new URL(request.url).pathname,
            method: request.method,
          });
          return jsonError('Invalid CSRF token', 403);
        }
      }

      // ---------------------------------------------------------------
      // 4. Rate limiting (FAILLE-009 FIX: Redis-backed with in-memory fallback)
      // ---------------------------------------------------------------
      const ip = getClientIp(request);
      const pathname = new URL(request.url).pathname;
      // FAILLE-078 FIX: Normalize dynamic segments so rate limit buckets are shared per route pattern
      const normalizedPath = pathname.replace(/\/[a-zA-Z0-9_-]{20,}(?=\/|$)/g, '/[id]');
      const rateLimitKey = `admin:${ip}:${normalizedPath}`;

      const maxRequests =
        options?.rateLimit ??
        (isMutation ? RATE_LIMIT_WRITE : RATE_LIMIT_READ);

      // Try Redis-backed rate limiter first (persists across deploys/restarts),
      // fall back to in-memory rate limiter if Redis is unavailable.
      let rateResult: { allowed: boolean; remaining: number; resetIn: number };
      try {
        const redisResult = await checkRateLimitRedis(ip, normalizedPath, session.user.id);
        rateResult = {
          allowed: redisResult.allowed,
          remaining: redisResult.remaining,
          resetIn: Math.max(0, redisResult.resetAt - Date.now()),
        };
      } catch {
        // Redis unavailable - gracefully fall back to in-memory rate limiting
        rateResult = checkRateLimitMemory(rateLimitKey, maxRequests, RATE_LIMIT_WINDOW_MS);
      }

      if (!rateResult.allowed) {
        const retryAfterSeconds = Math.ceil(rateResult.resetIn / 1000);
        return jsonError('Too many requests', 429, {
          'Retry-After': String(retryAfterSeconds),
          'X-RateLimit-Limit': String(maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(retryAfterSeconds),
        });
      }

      // ---------------------------------------------------------------
      // 5. Resolve route params and execute handler
      // ---------------------------------------------------------------
      let params: Record<string, string> | undefined;
      if (routeContext?.params) {
        params = await routeContext.params;
      }

      const response = await handler(request, { session, params });

      // Attach rate-limit headers to successful responses
      response.headers.set('X-RateLimit-Limit', String(maxRequests));
      response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining));
      response.headers.set('X-RateLimit-Reset', String(Math.ceil(rateResult.resetIn / 1000)));

      // Ensure we return NextResponse (handler may return plain Response)
      return response as NextResponse;
    } catch (error) {
      const method = request.method;
      const url = request.url;
      logger.error('AdminGuard unhandled error', {
        method,
        url,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // FAILLE-022 FIX: Never expose error.message to client, even in dev
      const message = 'Internal server error';

      return jsonError(message, 500);
    }
  };
}
