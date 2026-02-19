/**
 * Standardized API Response Helpers (Backend Round 2)
 *
 * Provides a consistent response envelope for ALL API responses:
 *
 * Success:
 *   { success: true, data: ..., meta: { timestamp, requestId } }
 *
 * Error:
 *   { success: false, error: { message, code, details? }, meta: { timestamp, requestId } }
 *
 * Paginated:
 *   { success: true, data: [...], meta: { timestamp, requestId },
 *     pagination: { page, pageSize, total, totalPages, hasNext, hasPrev } }
 *
 * Also provides:
 *   - ETag support (Item 3)
 *   - API version header (Item 4)
 *   - Rate limit header passthrough (Item 5)
 *   - Request ID tracking (Item 6)
 *   - Allow header on 405 (Item 8)
 *   - X-Total-Count for paginated lists (Item 10)
 *   - Content-Type validation (Item 12)
 *   - Link header for pagination (Item 15)
 *   - HTTP 204 helper for deletes (Item 2)
 *
 * NOTE: v2 API routes will live under /api/v2/ when needed. (Item 4 doc)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { ErrorCode, ErrorCodeType, ErrorCodeStatus } from '@/lib/error-codes';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Current API version included in every response header */
const API_VERSION = '1';

// ---------------------------------------------------------------------------
// Request ID
// ---------------------------------------------------------------------------

/**
 * Get or generate a request ID for the current request.
 * Prefers the x-request-id header set by middleware; falls back to a new UUID.
 */
export function getRequestId(request?: NextRequest): string {
  if (request) {
    const existing = request.headers.get('x-request-id');
    if (existing) return existing;
  }
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Meta builder
// ---------------------------------------------------------------------------

interface ResponseMeta {
  timestamp: string;
  requestId: string;
}

function buildMeta(requestId: string): ResponseMeta {
  return {
    timestamp: new Date().toISOString(),
    requestId,
  };
}

// ---------------------------------------------------------------------------
// Standard headers applied to every response
// ---------------------------------------------------------------------------

function applyStandardHeaders(
  response: NextResponse,
  requestId: string,
  extraHeaders?: Record<string, string>
): NextResponse {
  response.headers.set('X-API-Version', API_VERSION);
  response.headers.set('X-Request-Id', requestId);
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      response.headers.set(key, value);
    }
  }
  return response;
}

// ---------------------------------------------------------------------------
// Success response (Item 1)
// ---------------------------------------------------------------------------

export function apiSuccess<T>(
  data: T,
  options?: {
    status?: number;
    request?: NextRequest;
    requestId?: string;
    headers?: Record<string, string>;
  }
): NextResponse {
  const status = options?.status ?? 200;
  const requestId = options?.requestId ?? getRequestId(options?.request);

  const body = {
    success: true as const,
    data,
    meta: buildMeta(requestId),
  };

  const response = NextResponse.json(body, { status });
  return applyStandardHeaders(response, requestId, options?.headers);
}

// ---------------------------------------------------------------------------
// Error response (Item 1 + Item 7)
// ---------------------------------------------------------------------------

export function apiError(
  message: string,
  code: ErrorCodeType | string = ErrorCode.INTERNAL_ERROR,
  options?: {
    status?: number;
    details?: unknown;
    request?: NextRequest;
    requestId?: string;
    headers?: Record<string, string>;
  }
): NextResponse {
  const status =
    options?.status ??
    (code in ErrorCodeStatus
      ? ErrorCodeStatus[code as ErrorCodeType]
      : 500);
  const requestId = options?.requestId ?? getRequestId(options?.request);

  const errorPayload: { message: string; code: string; details?: unknown } = {
    message,
    code,
  };
  if (options?.details !== undefined) {
    errorPayload.details = options.details;
  }

  const body = {
    success: false as const,
    error: errorPayload,
    meta: buildMeta(requestId),
  };

  const response = NextResponse.json(body, { status });
  return applyStandardHeaders(response, requestId, options?.headers);
}

// ---------------------------------------------------------------------------
// Paginated response (Item 1 + Item 10 + Item 15)
// ---------------------------------------------------------------------------

export function apiPaginated<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number,
  options?: {
    request?: NextRequest;
    requestId?: string;
    headers?: Record<string, string>;
  }
): NextResponse {
  const requestId = options?.requestId ?? getRequestId(options?.request);
  const totalPages = Math.ceil(total / pageSize);

  const body = {
    success: true as const,
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
    meta: buildMeta(requestId),
  };

  const response = NextResponse.json(body, { status: 200 });

  // Item 10: X-Total-Count header
  response.headers.set('X-Total-Count', String(total));

  // Item 15: Link header (RFC 5988) for pagination
  if (options?.request) {
    const linkParts: string[] = [];
    const baseUrl = new URL(options.request.url);

    if (page < totalPages) {
      baseUrl.searchParams.set('page', String(page + 1));
      linkParts.push(`<${baseUrl.toString()}>; rel="next"`);
    }
    if (page > 1) {
      baseUrl.searchParams.set('page', String(page - 1));
      linkParts.push(`<${baseUrl.toString()}>; rel="prev"`);
    }
    baseUrl.searchParams.set('page', '1');
    linkParts.push(`<${baseUrl.toString()}>; rel="first"`);
    baseUrl.searchParams.set('page', String(totalPages));
    linkParts.push(`<${baseUrl.toString()}>; rel="last"`);

    if (linkParts.length > 0) {
      response.headers.set('Link', linkParts.join(', '));
    }
  }

  return applyStandardHeaders(response, requestId, options?.headers);
}

// ---------------------------------------------------------------------------
// HTTP 204 No Content for DELETE operations (Item 2)
// ---------------------------------------------------------------------------

export function apiNoContent(options?: {
  request?: NextRequest;
  requestId?: string;
}): NextResponse {
  const requestId = options?.requestId ?? getRequestId(options?.request);
  const response = new NextResponse(null, { status: 204 });
  return applyStandardHeaders(response, requestId);
}

// ---------------------------------------------------------------------------
// HTTP 405 Method Not Allowed with Allow header (Item 8)
// ---------------------------------------------------------------------------

export function apiMethodNotAllowed(
  allowedMethods: string[],
  options?: {
    request?: NextRequest;
    requestId?: string;
  }
): NextResponse {
  const requestId = options?.requestId ?? getRequestId(options?.request);
  const allow = allowedMethods.join(', ');
  return apiError(
    `Method not allowed. Allowed: ${allow}`,
    ErrorCode.METHOD_NOT_ALLOWED,
    {
      status: 405,
      requestId,
      headers: { Allow: allow },
    }
  );
}

// ---------------------------------------------------------------------------
// ETag support (Item 3)
// ---------------------------------------------------------------------------

/**
 * Compute an ETag (weak) from the JSON data payload.
 */
export function computeETag(data: unknown): string {
  const hash = createHash('md5')
    .update(JSON.stringify(data))
    .digest('hex');
  return `W/"${hash}"`;
}

/**
 * Wrap a response with ETag support.
 * If the request has an If-None-Match header matching the ETag, returns 304.
 */
export function withETag<T>(
  data: T,
  request: NextRequest,
  options?: {
    requestId?: string;
    headers?: Record<string, string>;
    cacheControl?: string;
  }
): NextResponse {
  const etag = computeETag(data);
  const ifNoneMatch = request.headers.get('if-none-match');

  if (ifNoneMatch && ifNoneMatch === etag) {
    const requestId = options?.requestId ?? getRequestId(request);
    const response = new NextResponse(null, { status: 304 });
    response.headers.set('ETag', etag);
    return applyStandardHeaders(response, requestId, options?.headers);
  }

  const response = apiSuccess(data, {
    request,
    requestId: options?.requestId,
    headers: {
      ETag: etag,
      ...(options?.cacheControl ? { 'Cache-Control': options.cacheControl } : {}),
      ...options?.headers,
    },
  });

  return response;
}

// ---------------------------------------------------------------------------
// Content-Type validation (Item 12)
// ---------------------------------------------------------------------------

/**
 * Validate that the Content-Type header is application/json for mutation requests.
 * Returns null if valid, or an error NextResponse if invalid.
 */
export function validateContentType(request: NextRequest): NextResponse | null {
  const method = request.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH'].includes(method)) return null;

  const contentType = request.headers.get('content-type');
  if (!contentType) {
    return apiError(
      'Content-Type header is required for this request',
      ErrorCode.UNSUPPORTED_MEDIA_TYPE,
      { status: 415, request }
    );
  }

  // Allow application/json and application/json; charset=utf-8
  if (!contentType.toLowerCase().includes('application/json')) {
    return apiError(
      'Content-Type must be application/json',
      ErrorCode.UNSUPPORTED_MEDIA_TYPE,
      { status: 415, request }
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Date formatting (Item 9) - All dates are ISO 8601 by default in Prisma.
// This is a reminder/utility for custom date strings.
// ---------------------------------------------------------------------------

/**
 * Ensure a date value is formatted as ISO 8601 string.
 */
export function toISO8601(date: Date | string | number): string {
  return new Date(date).toISOString();
}

// ---------------------------------------------------------------------------
// Field selection support (Item 11)
// ---------------------------------------------------------------------------

/**
 * Parse ?fields=name,price,slug into a Prisma select object.
 * Returns undefined if no fields param is present (meaning select all).
 */
export function parseFieldSelection(
  request: NextRequest,
  allowedFields: string[]
): Record<string, true> | undefined {
  const fieldsParam = request.nextUrl.searchParams.get('fields');
  if (!fieldsParam) return undefined;

  const requested = fieldsParam
    .split(',')
    .map((f) => f.trim())
    .filter((f) => allowedFields.includes(f));

  if (requested.length === 0) return undefined;

  // Always include 'id' for proper resource identification
  const select: Record<string, true> = { id: true };
  for (const field of requested) {
    select[field] = true;
  }
  return select;
}
