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
import { checkRateLimit } from '@/lib/security';
import { UserRole } from '@/types';
import { logger } from '@/lib/logger';
import type { Session } from 'next-auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AdminHandler = (
  request: NextRequest,
  context: { session: Session; params?: Record<string, string> }
) => Promise<NextResponse>;

interface AdminGuardOptions {
  /** Skip CSRF validation for this route (e.g. GET-only endpoints). Default: false */
  skipCsrf?: boolean;
  /** Override rate limit (requests per minute). Default: 60 for reads, 30 for writes */
  rateLimit?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** HTTP methods considered as mutations (require CSRF protection) */
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Rate limits per minute */
const RATE_LIMIT_READ = 60;
const RATE_LIMIT_WRITE = 30;

/** Rate limit window in milliseconds (1 minute) */
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

/** Roles allowed to access admin API routes */
const ADMIN_ROLES = new Set<string>([UserRole.EMPLOYEE, UserRole.OWNER]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
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
  return async (request: NextRequest, routeContext?: { params?: Promise<Record<string, string>> }): Promise<NextResponse> => {
    try {
      // ---------------------------------------------------------------
      // 1. Authentication
      // ---------------------------------------------------------------
      const session = await auth();

      if (!session?.user) {
        return jsonError('Unauthorized', 401);
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
      // 4. Rate limiting
      // ---------------------------------------------------------------
      const ip = getClientIp(request);
      const pathname = new URL(request.url).pathname;
      const rateLimitKey = `admin:${ip}:${pathname}`;

      const maxRequests =
        options?.rateLimit ??
        (isMutation ? RATE_LIMIT_WRITE : RATE_LIMIT_READ);

      const rateResult = checkRateLimit(rateLimitKey, maxRequests, RATE_LIMIT_WINDOW_MS);

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

      return response;
    } catch (error) {
      const method = request.method;
      const url = request.url;
      logger.error('AdminGuard unhandled error', {
        method,
        url,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      const message =
        process.env.NODE_ENV === 'development' && error instanceof Error
          ? error.message
          : 'Internal server error';

      return jsonError(message, 500);
    }
  };
}
