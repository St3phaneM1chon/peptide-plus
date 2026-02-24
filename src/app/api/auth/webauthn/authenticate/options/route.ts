export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { prisma } from '@/lib/db';
import { rpID } from '@/lib/webauthn';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

type AuthenticatorTransport = 'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email } = body;

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
