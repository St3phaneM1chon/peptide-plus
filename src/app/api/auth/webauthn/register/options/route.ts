export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { rpName, rpID } from '@/lib/webauthn';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { authenticators: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const existingAuthenticators = user.authenticators.map((auth) => ({
      id: Buffer.from(auth.credentialID, 'base64url'),
      type: 'public-key' as const,
      transports: auth.transports
        ? (auth.transports.split(',') as AuthenticatorTransport[])
        : undefined,
    }));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: user.id,
      userName: user.email,
      userDisplayName: user.name || user.email,
      attestationType: 'none',
      excludeCredentials: existingAuthenticators,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform', // Only platform authenticators (Face ID, Touch ID)
      },
    });

    // Store challenge in cookie for verification
    const cookieStore = await cookies();
    cookieStore.set('webauthn-challenge', options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 300, // 5 minutes
      path: '/',
    });

    return NextResponse.json(options);
  } catch (error) {
    logger.error('WebAuthn register options error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to generate registration options' },
      { status: 500 }
    );
  }
}

type AuthenticatorTransport = 'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb';
