/**
 * Shared API route handler wrapper.
 * Provides: standardized error responses, auth checks, request parsing, logging.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import { ZodSchema, ZodError } from 'zod';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

// Standard API error response
interface ApiError {
  error: string;
  details?: unknown;
  status: number;
}

// Handler context passed to route handlers
export interface ApiContext {
  request: NextRequest;
  params?: Record<string, string>;
  session?: {
    user: {
      id: string;
      email: string;
      role: string;
      name?: string | null;
    };
  };
}

// Options for the handler wrapper
interface HandlerOptions {
  /** Require authentication. Default: false */
  auth?: boolean;
  /** Require specific roles. Implies auth: true */
  roles?: string[];
  /** Zod schema for request body validation (POST/PUT/PATCH) */
  schema?: ZodSchema;
  /** Enable rate limiting. Default: true. Set to false to disable. */
  rateLimit?: boolean;
  /** Maximum request body size in bytes. Default: 1MB (1_000_000). Set to 0 to disable. */
  maxBodySize?: number;
}

/** Default max body size: 1MB */
const DEFAULT_MAX_BODY_SIZE = 1_000_000;

/**
 * Standalone body size validation utility.
 * Use this in routes that don't use withApiHandler.
 *
 * Returns the parsed body if valid, or a NextResponse error if too large.
 */
export async function validateBodySize(
  request: NextRequest,
  maxSize: number = DEFAULT_MAX_BODY_SIZE
): Promise<{ data: unknown } | { error: NextResponse }> {
  try {
    const text = await request.text();
    if (text.length > maxSize) {
      return {
        error: NextResponse.json(
          { error: `Request body too large. Maximum size: ${Math.round(maxSize / 1024)}KB` },
          { status: 413 }
        ),
      };
    }
    const data = JSON.parse(text);
    return { data };
  } catch {
    return {
      error: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    };
  }
}

/**
 * Create a standardized API error response.
 */
export function apiError(message: string, status: number, details?: unknown): NextResponse {
  const body: ApiError = { error: message, status };
  if (details) body.details = details;
  return NextResponse.json(body, { status });
}

/**
 * Create a standardized API success response.
 */
export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * Wrap an API route handler with standardized error handling, auth, and validation.
 *
 * Usage:
 * ```ts
 * export const POST = withApiHandler(async (ctx) => {
 *   const body = await ctx.request.json();
 *   return apiSuccess({ id: '123' }, 201);
 * }, { auth: true, roles: ['EMPLOYEE', 'OWNER'], schema: createProductSchema });
 * ```
 */
export function withApiHandler(
  handler: (ctx: ApiContext) => Promise<NextResponse>,
  options: HandlerOptions = {}
) {
  return async (request: NextRequest, routeContext?: { params?: Promise<Record<string, string>> }) => {
    // Generate or propagate a correlation ID for request tracing
    const requestId =
      request.headers.get('x-request-id') || crypto.randomUUID();

    try {
      const ctx: ApiContext = { request };

      // Resolve route params if present
      if (routeContext?.params) {
        ctx.params = await routeContext.params;
      }

      // Rate limiting (enabled by default)
      if (options.rateLimit !== false) {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          || request.headers.get('x-real-ip')
          || '127.0.0.1';
        const path = new URL(request.url).pathname;
        const rl = await rateLimitMiddleware(ip, path);

        if (!rl.success) {
          const res = NextResponse.json(
            { error: rl.error!.message, status: 429 },
            { status: 429 }
          );
          res.headers.set('x-request-id', requestId);
          Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
          return res;
        }
      }

      // Auth check
      if (options.auth || options.roles) {
        const session = await auth();

        if (!session?.user) {
          return apiError('Unauthorized', 401);
        }

        ctx.session = session as ApiContext['session'];

        // Role check
        if (options.roles && options.roles.length > 0) {
          const userRole = session.user.role as string;
          // OWNER always has access
          if (userRole !== UserRole.OWNER && !options.roles.includes(userRole)) {
            return apiError('Forbidden', 403);
          }
        }
      }

      // Body size validation (for POST/PUT/PATCH)
      const maxSize = options.maxBodySize ?? DEFAULT_MAX_BODY_SIZE;
      if (maxSize > 0) {
        const method = request.method.toUpperCase();
        if (['POST', 'PUT', 'PATCH'].includes(method)) {
          const contentLength = request.headers.get('content-length');
          if (contentLength && parseInt(contentLength, 10) > maxSize) {
            return apiError(`Request body too large. Maximum size: ${Math.round(maxSize / 1024)}KB`, 413);
          }
        }
      }

      // Body validation with Zod (for POST/PUT/PATCH)
      if (options.schema) {
        const method = request.method.toUpperCase();
        if (['POST', 'PUT', 'PATCH'].includes(method)) {
          try {
            const body = await request.clone().json();
            options.schema.parse(body);
          } catch (err) {
            if (err instanceof ZodError) {
              return apiError('Validation error', 400, {
                issues: err.issues.map(i => ({
                  path: i.path.join('.'),
                  message: i.message,
                })),
              });
            }
            // JSON parse error
            return apiError('Invalid JSON body', 400);
          }
        }
      }

      // Execute handler
      const response = await handler(ctx);
      response.headers.set('x-request-id', requestId);
      return response;
    } catch (error) {
      // Structured error logging with correlation ID
      const method = request.method;
      const url = request.url;
      logger.error('API handler unhandled error', {
        requestId,
        method,
        url,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Don't leak error details in production
      const message = process.env.NODE_ENV === 'development' && error instanceof Error
        ? error.message
        : 'Internal server error';

      const errorResponse = apiError(message, 500);
      errorResponse.headers.set('x-request-id', requestId);
      return errorResponse;
    }
  };
}
