export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { prisma } from '@/lib/db';
import { rpID, origin } from '@/lib/webauthn';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const credential = await request.json();

    // Get challenge from cookie
    const cookieStore = await cookies();
    const challenge = cookieStore.get('webauthn-challenge')?.value;

    if (!challenge) {
      return NextResponse.json(
        { error: 'Challenge expired. Please try again.' },
        { status: 400 }
      );
    }

    // Find the authenticator by credential ID
    const credentialIDBase64 = Buffer.from(credential.rawId, 'base64').toString('base64url');

    const authenticator = await prisma.authenticator.findUnique({
      where: { credentialID: credentialIDBase64 },
      include: { user: true },
    });

    if (!authenticator) {
      return NextResponse.json(
        { error: 'Passkey not recognized' },
        { status: 400 }
      );
    }

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: Buffer.from(authenticator.credentialID, 'base64url'),
        credentialPublicKey: Buffer.from(authenticator.credentialPublicKey, 'base64url'),
        counter: authenticator.counter,
        transports: authenticator.transports
          ? (authenticator.transports.split(',') as AuthenticatorTransport[])
          : undefined,
      },
    });

    if (!verification.verified) {
      return NextResponse.json(
        { error: 'Verification failed' },
        { status: 400 }
      );
    }

    // Update counter and lastUsedAt
    await prisma.authenticator.update({
      where: {
        userId_credentialID: {
          userId: authenticator.userId,
          credentialID: authenticator.credentialID,
        },
      },
      data: {
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      },
    });

    // Create a NextAuth-compatible JWT session token
    const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const user = authenticator.user;
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.image,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
        sub: user.id,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      },
      secret,
      { algorithm: 'HS256' }
    );

    // Clear challenge cookies
    cookieStore.delete('webauthn-challenge');
    cookieStore.delete('webauthn-email');

    // Set the NextAuth session cookie
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieName = isProduction
      ? '__Secure-authjs.session-token'
      : 'authjs.session-token';

    cookieStore.set(cookieName, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 3600,
      path: '/',
    });

    return NextResponse.json({
      verified: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error('WebAuthn auth verify error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}

type AuthenticatorTransport = 'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb';
