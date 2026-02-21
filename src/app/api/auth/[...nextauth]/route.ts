export const dynamic = 'force-dynamic';

/**
 * ROUTE NEXTAUTH
 * Gestion de l'authentification
 *
 * AZURE FIX: Azure App Service terminates TLS at the load balancer and uses
 * x-arr-ssl header instead of the standard x-forwarded-proto header.
 * Auth.js relies on x-forwarded-proto to detect HTTPS. Without it, cookie
 * names may switch between __Secure- and non-prefixed versions, causing
 * PKCE/state cookie decryption failures ("could not be parsed").
 */

import { handlers } from '@/lib/auth-config';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitMiddleware } from '@/lib/rate-limiter';

function fixAzureRequest(req: NextRequest): NextRequest {
  const xArrSsl = req.headers.get('x-arr-ssl');
  const proto = req.headers.get('x-forwarded-proto');

  // TEMPORARY DEBUG: Log all cookies and headers on auth routes
  const url = req.nextUrl.pathname;
  if (url.includes('/callback/') || url.includes('/signin/')) {
    const cookieNames = req.cookies.getAll().map(c => `${c.name}(${c.value.length})`);
    console.log(JSON.stringify({
      event: 'auth_debug',
      url,
      proto: proto || 'MISSING',
      xArrSsl: xArrSsl ? 'PRESENT' : 'ABSENT',
      host: req.headers.get('host'),
      cookies: cookieNames,
      hasPkce: !!req.cookies.get('authjs.pkce.code_verifier'),
      hasSecurePkce: !!req.cookies.get('__Secure-authjs.pkce.code_verifier'),
      hasState: !!req.cookies.get('authjs.state'),
      hasSecureState: !!req.cookies.get('__Secure-authjs.state'),
    }));
  }

  // Azure terminates TLS and uses x-arr-ssl instead of x-forwarded-proto
  if (xArrSsl && !proto) {
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    if (host) {
      const envOrigin = `https://${host}`;
      const { href, origin } = req.nextUrl;
      return new NextRequest(href.replace(origin, envOrigin), req);
    }
  }
  return req;
}

export const GET = (req: NextRequest) => handlers.GET(fixAzureRequest(req));

export const POST = async (req: NextRequest) => {
  // SEC-002: Rate limit signin POST requests (credentials login) by IP
  // This complements the per-email brute-force protection in auth-config.ts
  const pathname = req.nextUrl.pathname;
  if (pathname.includes('/callback/credentials') || pathname.includes('/signin')) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/auth/login');
    if (!rl.success) {
      return NextResponse.json(
        { error: rl.error!.message },
        { status: 429, headers: rl.headers }
      );
    }
  }
  return handlers.POST(fixAzureRequest(req));
};
