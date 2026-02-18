/**
 * TEMPORARY DEBUG ENDPOINT - DELETE AFTER OAUTH IS WORKING
 * Checks environment variables and headers relevant to Auth.js on Azure
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Only allow in production for debugging, but mask sensitive values
  const mask = (val: string | undefined) => {
    if (!val) return '❌ MISSING';
    if (val.length <= 8) return '✅ SET (short)';
    return `✅ SET (${val.length} chars, starts: ${val.substring(0, 4)}...)`;
  };

  const boolCheck = (val: string | undefined) => {
    if (!val) return '❌ MISSING';
    return `✅ ${val}`;
  };

  const headers: Record<string, string | null> = {
    host: request.headers.get('host'),
    'x-forwarded-for': request.headers.get('x-forwarded-for'),
    'x-forwarded-proto': request.headers.get('x-forwarded-proto'),
    'x-forwarded-host': request.headers.get('x-forwarded-host'),
    'x-original-url': request.headers.get('x-original-url'),
    'x-arr-ssl': request.headers.get('x-arr-ssl'),
  };

  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    auth: {
      AUTH_SECRET: mask(process.env.AUTH_SECRET),
      NEXTAUTH_SECRET: mask(process.env.NEXTAUTH_SECRET),
      AUTH_URL: process.env.AUTH_URL || '❌ MISSING',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || '❌ MISSING',
      AUTH_TRUST_HOST: boolCheck(process.env.AUTH_TRUST_HOST),
    },
    oauth_providers: {
      GOOGLE_CLIENT_ID: mask(process.env.GOOGLE_CLIENT_ID),
      GOOGLE_CLIENT_SECRET: mask(process.env.GOOGLE_CLIENT_SECRET),
      TWITTER_CLIENT_ID: mask(process.env.TWITTER_CLIENT_ID),
      TWITTER_CLIENT_SECRET: mask(process.env.TWITTER_CLIENT_SECRET),
      FACEBOOK_CLIENT_ID: mask(process.env.FACEBOOK_CLIENT_ID),
      FACEBOOK_CLIENT_SECRET: mask(process.env.FACEBOOK_CLIENT_SECRET),
    },
    server: {
      HOSTNAME: process.env.HOSTNAME || '❌ MISSING (standalone may bind to localhost only)',
      PORT: process.env.PORT || '3000 (default)',
    },
    azure_headers: headers,
    request_url: request.url,
  };

  return NextResponse.json(diagnostics, { status: 200 });
}
