/**
 * Standardized API Error Codes (Backend Round 2 - Item 7)
 *
 * Consistent, machine-readable error codes for all API responses.
 * Use with apiError() from api-response.ts.
 *
 * Client-side code can switch on these codes to provide localized messages.
 */

export const ErrorCode = {
  // 400 - Client errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',

  // 401 - Authentication
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  // 403 - Authorization
  FORBIDDEN: 'FORBIDDEN',
  CSRF_INVALID: 'CSRF_INVALID',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  // 404 - Not found
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',

  // 405 - Method not allowed
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',

  // 409 - Conflict
  CONFLICT: 'CONFLICT',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',

  // 413 - Payload too large
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',

  // 415 - Unsupported media type
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',

  // 429 - Rate limited
  RATE_LIMITED: 'RATE_LIMITED',

  // 500 - Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',

  // 502 - Payment/external failures
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Map of error codes to their default HTTP status codes.
 */
export const ErrorCodeStatus: Record<ErrorCodeType, number> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.MISSING_FIELD]: 400,
  [ErrorCode.INVALID_FORMAT]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.INVALID_CREDENTIALS]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.CSRF_INVALID]: 403,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.METHOD_NOT_ALLOWED]: 405,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.DUPLICATE_ENTRY]: 409,
  [ErrorCode.PAYLOAD_TOO_LARGE]: 413,
  [ErrorCode.UNSUPPORTED_MEDIA_TYPE]: 415,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.PAYMENT_FAILED]: 502,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
};
