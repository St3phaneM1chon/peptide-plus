/**
 * Reusable Zod validation helper for API routes.
 *
 * Usage:
 *   const result = validateBody(mySchema, body);
 *   if (!result.success) return result.response;
 *   const data = result.data;
 */

import { z } from 'zod';
import { NextResponse } from 'next/server';

type ValidationSuccess<T> = { success: true; data: T };
type ValidationFailure = { success: false; response: NextResponse };

/**
 * Validate an unknown request body against a Zod schema.
 * Returns either { success: true, data } or { success: false, response }
 * where response is a ready-to-return 400 NextResponse with error details.
 */
export function validateBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): ValidationSuccess<T> | ValidationFailure {
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      ),
    };
  }
  return { success: true, data: result.data };
}

/**
 * Validate query/search params against a Zod schema.
 * Useful for GET endpoints that accept typed query parameters.
 */
export function validateQuery<T>(
  schema: z.ZodSchema<T>,
  params: Record<string, string | null>
): ValidationSuccess<T> | ValidationFailure {
  const result = schema.safeParse(params);
  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Invalid query parameters', details: result.error.flatten() },
        { status: 400 }
      ),
    };
  }
  return { success: true, data: result.data };
}
