export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { prisma } from '@/lib/db';
import { rpID } from '@/lib/webauthn';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { z } from 'zod';
import { getClientIpFromRequest } from '@/lib/admin-audit';

type AuthenticatorTransport = 'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb';

// Zod schema for request body validation
const webauthnAuthOptionsSchema = z.object({
  email: z.string().email().max(320).optional(),
}).strict();

// CSRF EXCEPTION (audited 2026-02-24): WebAuthn routes do not require separate CSRF
// protection. The WebAuthn protocol provides built-in challenge-response authentication:
// a unique challenge is generated server-side, stored in an httpOnly/secure/sameSite=strict
// cookie, and must be cryptographically signed by the authenticator device during
// verification. This makes cross-site request forgery infeasible.
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limit WebAuthn authentication options requests
    // SEC-FIX: Use rightmost XFF IP + Azure header to prevent rate-limit bypass via spoofed X-Forwarded-For
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/auth/login');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    const rawBody = await request.json().catch(() => ({}));
    const parsed = webauthnAuthOptionsSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { email } = parsed.data;

    let allowCredentials: { id: Uint8Array; type: 'public-key'; transports?: AuthenticatorTransport[] }[] | undefined;

    // If email provided, restrict to that user's credentials
    if (email) {
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        include: { authenticators: true },
      });

      // SECURITY FIX: Do not reveal whether the account exists or has passkeys.
      // If user doesn't exist or has no passkeys, generate options without
      // allowCredentials (discoverable credential flow) so the response is
      // indistinguishable from a valid request.
      if (user && user.authenticators.length > 0) {
        allowCredentials = user.authenticators.map((auth) => ({
          id: Buffer.from(auth.credentialID, 'base64url'),
          type: 'public-key' as const,
          transports: auth.transports
            ? (auth.transports.split(',') as AuthenticatorTransport[])
            : undefined,
        }));
      }
      // else: allowCredentials remains undefined → browser shows all available passkeys
    }

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
      allowCredentials,
    });

    // Store challenge in cookie
    const cookieStore = await cookies();
    cookieStore.set('webauthn-challenge', options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 300,
      path: '/',
    });

    // Also store email if provided for verification step
    if (email) {
      cookieStore.set('webauthn-email', email.toLowerCase(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 300,
        path: '/',
      });
    }

    return NextResponse.json(options);
  } catch (error) {
    logger.error('WebAuthn auth options error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to generate authentication options' },
      { status: 500 }
    );
  }
}
