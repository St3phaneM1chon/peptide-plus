import { NextRequest } from 'next/server';
import { verifyCSRFToken } from '@/lib/csrf';

/**
 * Server-side CSRF validation helper for API routes.
 * Uses the double-submit cookie pattern with HMAC-SHA256 verification.
 *
 * The cookie contains an encoded CSRFToken (token + expiry + HMAC signature).
 * The header contains the raw token. verifyCSRFToken checks that:
 *   1. The cookie is not expired
 *   2. The HMAC signature in the cookie is valid (not tampered)
 *   3. The raw token in the header matches the token inside the cookie
 *
 * @returns true if the CSRF check passes, false otherwise
 */
export async function validateCsrf(request: NextRequest): Promise<boolean> {
  const headerToken = request.headers.get('X-CSRF-Token') || request.headers.get('x-csrf-token');
  const cookieToken = request.cookies.get('csrf-token')?.value;

  if (!headerToken || !cookieToken) return false;

  const result = verifyCSRFToken(cookieToken, headerToken);
  return result.valid;
}
