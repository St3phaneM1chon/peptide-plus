export const dynamic = 'force-dynamic';

/**
 * Mobile API Guard — Authentication for mobile app (iOS) API routes.
 *
 * Unlike withAdminGuard, this guard:
 * - Accepts ANY authenticated user (CUSTOMER, EMPLOYEE, OWNER)
 * - Reads Bearer token from Authorization header (not cookies)
 * - Skips CSRF validation (mobile apps don't use CSRF tokens)
 * - Includes rate limiting
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-jwt';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MobileSession {
  user: {
    id: string;
    email: string;
    role: string;
    name?: string | null;
  };
}

type MobileHandler = (
  request: NextRequest,
  context: { session: MobileSession; params?: Record<string, string> }
) => Promise<NextResponse | Response>;

// ---------------------------------------------------------------------------
// Rate limiting (simple in-memory for mobile)
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute

function checkMobileRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

// Cleanup stale entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60_000);

// ---------------------------------------------------------------------------
// Standalone Bearer token resolver (for hybrid routes like chat)
// ---------------------------------------------------------------------------

/**
 * Extract and verify a session from a Bearer token in the Authorization header.
 * Returns null if no Bearer token or invalid token.
 * Use this as a fallback in routes that already use auth() for web sessions.
 */
export async function getSessionFromBearerToken(request: NextRequest): Promise<MobileSession | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload?.sub || !payload?.email) return null;

  return {
    user: {
      id: payload.sub as string,
      email: payload.email as string,
      role: (payload.role as string) || 'CUSTOMER',
    },
  };
}

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Wraps a mobile API route handler with Bearer token authentication.
 * Accepts any authenticated user role (CUSTOMER, EMPLOYEE, OWNER).
 */
export function withMobileGuard(handler: MobileHandler) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (request: NextRequest, routeContext?: any): Promise<NextResponse> => {
    try {
      // 1. Extract Bearer token
      const authHeader = request.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return jsonError('Unauthorized', 401);
      }

      const token = authHeader.slice(7);
      if (!token) {
        return jsonError('Unauthorized', 401);
      }

      // 2. Verify JWT
      const payload = await verifyToken(token);
      if (!payload?.sub || !payload?.email) {
        return jsonError('Invalid or expired token', 401);
      }

      // 3. Rate limiting
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || '127.0.0.1';
      const rateLimitKey = `mobile:${ip}:${payload.sub}`;
      if (!checkMobileRateLimit(rateLimitKey)) {
        return jsonError('Too many requests', 429);
      }

      // 4. Build session
      const session: MobileSession = {
        user: {
          id: payload.sub as string,
          email: payload.email as string,
          role: (payload.role as string) || 'CUSTOMER',
        },
      };

      // 5. Resolve route params
      let params: Record<string, string> | undefined;
      if (routeContext?.params) {
        params = await routeContext.params;
      }

      // 6. Execute handler
      const response = await handler(request, { session, params });
      return response as NextResponse;
    } catch (error) {
      logger.error('[MobileGuard] Unhandled error', {
        error: error instanceof Error ? error.message : String(error),
        url: request.url,
        method: request.method,
      });
      return jsonError('Internal server error', 500);
    }
  };
}
