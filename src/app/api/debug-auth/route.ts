/**
 * TEMPORARY DEBUG ENDPOINT - DELETE AFTER OAUTH IS WORKING
 * Checks environment variables, headers, and cookies relevant to Auth.js on Azure
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const mask = (val: string | undefined) => {
    if (!val) return 'MISSING';
    if (val.length <= 8) return `SET (${val.length} chars)`;
    return `SET (${val.length} chars, starts: ${val.substring(0, 4)}...)`;
  };

  // Show ALL cookies currently in the request (names + value length)
  const allCookies: Record<string, string> = {};
  for (const cookie of request.cookies.getAll()) {
    allCookies[cookie.name] = `${cookie.value.length} chars, starts: ${cookie.value.substring(0, 20)}...`;
  }

  // Check for both prefixed and non-prefixed auth cookies
  const authCookieCheck = {
    // Non-prefixed (our explicit config)
    'authjs.pkce.code_verifier': request.cookies.get('authjs.pkce.code_verifier')?.value ? 'PRESENT' : 'ABSENT',
    'authjs.state': request.cookies.get('authjs.state')?.value ? 'PRESENT' : 'ABSENT',
    'authjs.session-token': request.cookies.get('authjs.session-token')?.value ? 'PRESENT' : 'ABSENT',
    'authjs.callback-url': request.cookies.get('authjs.callback-url')?.value ? 'PRESENT' : 'ABSENT',
    'authjs.csrf-token': request.cookies.get('authjs.csrf-token')?.value ? 'PRESENT' : 'ABSENT',
    // Prefixed (default Auth.js behavior - should NOT be present with our config)
    '__Secure-authjs.pkce.code_verifier': request.cookies.get('__Secure-authjs.pkce.code_verifier')?.value ? 'PRESENT (BAD!)' : 'ABSENT (good)',
    '__Secure-authjs.session-token': request.cookies.get('__Secure-authjs.session-token')?.value ? 'PRESENT (BAD!)' : 'ABSENT (good)',
    '__Secure-authjs.callback-url': request.cookies.get('__Secure-authjs.callback-url')?.value ? 'PRESENT (BAD!)' : 'ABSENT (good)',
  };

  const headers: Record<string, string | null> = {
    host: request.headers.get('host'),
    'x-forwarded-proto': request.headers.get('x-forwarded-proto'),
    'x-forwarded-host': request.headers.get('x-forwarded-host'),
    'x-arr-ssl': request.headers.get('x-arr-ssl') ? 'PRESENT' : 'ABSENT',
  };

  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    auth: {
      AUTH_SECRET: mask(process.env.AUTH_SECRET),
      NEXTAUTH_SECRET: mask(process.env.NEXTAUTH_SECRET),
      AUTH_URL: process.env.AUTH_URL || 'MISSING',
      AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST || 'MISSING',
    },
    providers: {
      GOOGLE_CLIENT_ID: mask(process.env.GOOGLE_CLIENT_ID),
      TWITTER_CLIENT_ID: mask(process.env.TWITTER_CLIENT_ID),
    },
    server: {
      HOSTNAME: process.env.HOSTNAME || 'MISSING',
    },
    azure_headers: headers,
    all_cookies: allCookies,
    auth_cookie_check: authCookieCheck,
    request_url: request.url,
  };

  return NextResponse.json(diagnostics, { status: 200 });
}
