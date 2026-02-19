/**
 * Standardized API Error Responses (BE-SEC-15)
 *
 * Consistent error responses across all API routes.
 * Replaces ad-hoc NextResponse.json({ error: ... }, { status: ... }) calls.
 *
 * Usage:
 * ```ts
 * import { unauthorized, forbidden, badRequest, notFound, tooManyRequests, serverError } from '@/lib/api-errors';
 *
 * if (!session?.user) return unauthorized();
 * if (role !== 'ADMIN') return forbidden();
 * if (!productId) return badRequest('productId is required');
 * ```
 */

import { NextResponse } from 'next/server';

export function unauthorized(message = 'Authentication required') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = 'Access denied') {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = 'Resource not found') {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function tooManyRequests(retryAfter: number) {
  return NextResponse.json(
    { error: 'Too many requests' },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    }
  );
}

export function serverError(message = 'Internal server error') {
  return NextResponse.json({ error: message }, { status: 500 });
}
