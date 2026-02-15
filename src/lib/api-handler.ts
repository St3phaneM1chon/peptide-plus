/**
 * Shared API route handler wrapper.
 * Provides: standardized error responses, auth checks, request parsing, logging.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import { ZodSchema, ZodError } from 'zod';

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
    try {
      const ctx: ApiContext = { request };

      // Resolve route params if present
      if (routeContext?.params) {
        ctx.params = await routeContext.params;
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
      return await handler(ctx);
    } catch (error) {
      // Log the error
      const method = request.method;
      const url = request.url;
      console.error(`[API ${method} ${url}]`, error);

      // Don't leak error details in production
      const message = process.env.NODE_ENV === 'development' && error instanceof Error
        ? error.message
        : 'Internal server error';

      return apiError(message, 500);
    }
  };
}
