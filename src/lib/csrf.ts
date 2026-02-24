/**
 * CSRF PROTECTION
 * Double Submit Cookie pattern pour protection contre CSRF
 */

import { randomBytes, createHmac } from 'crypto';
import { logger } from '@/lib/logger';
// NOTE: cookies() from 'next/headers' is loaded dynamically inside server-only
// functions to avoid breaking client component imports of this module.
// See: verifyCSRFMiddleware() and setCSRFCookie()

// SECURITY: In production, CSRF_SECRET or NEXTAUTH_SECRET must be set.
// In development, use a stable dev-only secret instead of the insecure 'build-placeholder'.
// FAILLE-035 FIX: Use random secret in dev to avoid deterministic tokens
const DEV_FALLBACK_SECRET = randomBytes(32).toString('hex');

function resolveCSRFSecret(): string {
  const secret = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) return secret;

  // During Next.js build phase, return a placeholder (no requests are served)
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return DEV_FALLBACK_SECRET;
  }

  // In production runtime: throw to fail-closed
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'CSRF_SECRET or NEXTAUTH_SECRET must be set in production. CSRF protection cannot operate without a secret.'
    );
  }

  // Development: use a stable, clearly-marked dev secret
  if (typeof window === 'undefined') {
    logger.warn('[csrf] CSRF_SECRET not set - using development fallback (NOT safe for production)');
  }
  return DEV_FALLBACK_SECRET;
}

// FAILLE-036 FIX: Lazy resolve to avoid cold-start issues where env vars aren't ready yet
let _csrfSecret: string | null = null;
function getCSRFSecret(): string {
  if (!_csrfSecret) _csrfSecret = resolveCSRFSecret();
  return _csrfSecret;
}
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
// TODO: FAILLE-065 - No auto-refresh mechanism for expired CSRF tokens. If admin leaves page open >1h,
//       all mutations will fail 403. Add a refresh interceptor that detects 403 CSRF and re-fetches token.
const TOKEN_EXPIRY_MS = 3600000; // 1 heure

interface CSRFToken {
  token: string;
  expires: number;
  signature: string;
}

/**
 * Génère un nouveau token CSRF
 */
export function generateCSRFToken(): CSRFToken {
  const token = randomBytes(32).toString('hex');
  const expires = Date.now() + TOKEN_EXPIRY_MS;
  const data = `${token}:${expires}`;
  const signature = createHmac('sha256', getCSRFSecret()).update(data).digest('hex');

  return { token, expires, signature };
}

/**
 * Encode le token pour stockage dans le cookie
 */
export function encodeCSRFToken(csrfToken: CSRFToken): string {
  return Buffer.from(JSON.stringify(csrfToken)).toString('base64');
}

/**
 * Décode le token depuis le cookie
 */
export function decodeCSRFToken(encoded: string): CSRFToken | null {
  try {
    return JSON.parse(Buffer.from(encoded, 'base64').toString());
  } catch (error) {
    console.error('[CSRF] Failed to decode CSRF token:', error);
    return null;
  }
}

/**
 * Vérifie si un token CSRF est valide
 */
export function verifyCSRFToken(encoded: string, headerToken: string): {
  valid: boolean;
  error?: string;
} {
  const csrfData = decodeCSRFToken(encoded);

  if (!csrfData) {
    return { valid: false, error: 'Token CSRF invalide' };
  }

  // Vérifier l'expiration
  if (Date.now() > csrfData.expires) {
    return { valid: false, error: 'Token CSRF expiré' };
  }

  // Vérifier la signature
  const data = `${csrfData.token}:${csrfData.expires}`;
  const expectedSignature = createHmac('sha256', getCSRFSecret()).update(data).digest('hex');

  if (csrfData.signature !== expectedSignature) {
    return { valid: false, error: 'Signature CSRF invalide' };
  }

  // Vérifier que le token du header correspond
  if (csrfData.token !== headerToken) {
    return { valid: false, error: 'Token CSRF ne correspond pas' };
  }

  return { valid: true };
}

/**
 * Middleware pour vérifier le CSRF dans les API routes
 * Utilisation: await verifyCSRFMiddleware(request)
 */
export async function verifyCSRFMiddleware(request: Request): Promise<{
  valid: boolean;
  error?: string;
}> {
  // GET, HEAD, OPTIONS n'ont pas besoin de vérification CSRF
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return { valid: true };
  }

  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  if (!cookieToken) {
    // FAILLE-079 FIX: Log CSRF validation failures for security monitoring
    logger.warn('CSRF validation failed', { event: 'csrf_failed', reason: 'missing_cookie', method: request.method, url: request.url });
    return { valid: false, error: 'Cookie CSRF manquant' };
  }

  if (!headerToken) {
    logger.warn('CSRF validation failed', { event: 'csrf_failed', reason: 'missing_header', method: request.method, url: request.url });
    return { valid: false, error: 'Header CSRF manquant' };
  }

  const result = verifyCSRFToken(cookieToken, headerToken);
  if (!result.valid) {
    logger.warn('CSRF validation failed', { event: 'csrf_failed', reason: 'invalid_token', method: request.method, url: request.url });
  }
  return result;
}

/**
 * Génère un nouveau token et le définit dans les cookies
 * À appeler côté serveur (Server Component ou API route)
 */
export async function setCSRFCookie(): Promise<string> {
  const csrfToken = generateCSRFToken();
  const encoded = encodeCSRFToken(csrfToken);
  
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  cookieStore.set(CSRF_COOKIE_NAME, encoded, {
    httpOnly: false, // Doit être lisible par JS pour l'envoyer dans le header
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: TOKEN_EXPIRY_MS / 1000,
  });

  return csrfToken.token;
}

/**
 * Récupère le token actuel depuis le cookie (côté client)
 */
export function getCSRFTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === CSRF_COOKIE_NAME && value) {
      const decoded = decodeCSRFToken(decodeURIComponent(value));
      return decoded?.token || null;
    }
  }
  return null;
}

/**
 * Hook pour ajouter le token CSRF aux requêtes fetch
 * Utilisation côté client
 */
export function addCSRFHeader(headers: HeadersInit = {}): HeadersInit {
  const token = getCSRFTokenFromCookie();
  if (token) {
    return {
      ...headers,
      [CSRF_HEADER_NAME]: token,
    };
  }
  return headers;
}

/**
 * Wrapper fetch avec CSRF automatique
 */
export async function fetchWithCSRF(
  url: string | URL,
  init?: RequestInit
): Promise<Response> {
  const token = getCSRFTokenFromCookie();
  
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set(CSRF_HEADER_NAME, token);
  }

  return fetch(url, {
    ...init,
    headers,
  });
}
