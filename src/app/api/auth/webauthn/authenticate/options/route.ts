export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { prisma } from '@/lib/db';
import { rpID } from '@/lib/webauthn';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { z } from 'zod';

type AuthenticatorTransport = 'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb';

// Zod schema for request body validation
const webauthnAuthOptionsSchema = z.object({
  email: z.string().email().max(320).optional(),
}).strict();

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limit WebAuthn authentication options requests
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
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

      if (!user || user.authenticators.length === 0) {
        return NextResponse.json(
          { error: 'No passkey found for this account' },
          { status: 404 }
        );
      }

      allowCredentials = user.authenticators.map((auth) => ({
        id: Buffer.from(auth.credentialID, 'base64url'),
        type: 'public-key' as const,
        transports: auth.transports
          ? (auth.transports.split(',') as AuthenticatorTransport[])
          : undefined,
      }));
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
