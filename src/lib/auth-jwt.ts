/**
 * SHARED JWT MODULE — Single source of truth for direct auth API routes
 *
 * SECURITY FIXES:
 * - C-01: No fallback secret — throws if NEXTAUTH_SECRET is not set
 * - C-04: JWT expiry reduced from 30d to 1h (aligned with NextAuth session config)
 */

import { SignJWT, jwtVerify } from 'jose';
import { logger } from '@/lib/logger';

// C-01 FIX: NEVER use a fallback secret. Fail loudly if not configured.
function getJwtSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      'NEXTAUTH_SECRET environment variable is not set. Cannot sign JWT tokens.'
    );
  }
  return new TextEncoder().encode(secret);
}

// C-04 FIX: 1 hour expiry (was 30 days). Aligned with NextAuth session.maxAge.
const JWT_EXPIRY = '1h';

/**
 * Generate a signed JWT for direct auth routes (login, register, oauth).
 */
export async function generateToken(
  userId: string,
  email: string,
  role: string = 'CUSTOMER'
): Promise<string> {
  return await new SignJWT({ sub: userId, email, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(getJwtSecret());
}

/**
 * Verify and decode a JWT token.
 */
export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload;
  } catch (error) {
    logger.warn('JWT verification failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Format user object for API response (strips sensitive fields).
 */
export function formatUser(user: {
  id: string;
  email: string;
  name: string | null;
  role?: string;
  image?: string | null;
  mfaEnabled?: boolean;
  phone?: string | null;
  locale?: string | null;
  accounts?: Array<{ provider: string }>;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role?.toLowerCase() || 'customer',
    image: user.image || null,
    mfaEnabled: user.mfaEnabled || false,
    phone: user.phone || null,
    locale: user.locale || 'fr',
    authProvider:
      user.accounts?.[0]?.provider || 'email',
  };
}

// Email validation: RFC 5322 simplified
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate email format.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false; // RFC 5321 max
  return EMAIL_REGEX.test(email);
}

/**
 * Validate password strength.
 * Requirements: min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit.
 */
export function isStrongPassword(password: string): {
  valid: boolean;
  message?: string;
} {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Mot de passe requis' };
  }
  if (password.length < 8) {
    return {
      valid: false,
      message: 'Le mot de passe doit contenir au moins 8 caractères',
    };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      message: 'Le mot de passe doit contenir au moins une majuscule',
    };
  }
  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      message: 'Le mot de passe doit contenir au moins une minuscule',
    };
  }
  if (!/\d/.test(password)) {
    return {
      valid: false,
      message: 'Le mot de passe doit contenir au moins un chiffre',
    };
  }
  return { valid: true };
}

/**
 * Extract client IP from Next.js request.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || '127.0.0.1';
}
