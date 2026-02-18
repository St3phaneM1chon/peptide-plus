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
import { NextRequest } from 'next/server';

function fixAzureRequest(req: NextRequest): NextRequest {
  const xArrSsl = req.headers.get('x-arr-ssl');
  const proto = req.headers.get('x-forwarded-proto');

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
export const POST = (req: NextRequest) => handlers.POST(fixAzureRequest(req));
