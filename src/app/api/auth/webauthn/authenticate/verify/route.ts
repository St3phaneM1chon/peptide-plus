export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { prisma } from '@/lib/db';
import { rpID, origin } from '@/lib/webauthn';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limit WebAuthn authentication verification attempts
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/auth/login');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // INPUT-01 FIX: Zod validation for WebAuthn authentication credential
    // Note: We use passthrough() because the WebAuthn library expects its own
    // AuthenticationResponseJSON type with specific union fields like
    // authenticatorAttachment. We validate the required structure but let
    // additional/typed fields pass through to the library for deep validation.
    const webAuthnAuthSchema = z.object({
      id: z.string().min(1),
      rawId: z.string().min(1),
      type: z.literal('public-key'),
      response: z.object({
        authenticatorData: z.string().min(1),
        clientDataJSON: z.string().min(1),
        signature: z.string().min(1),
        userHandle: z.string().optional(),
      }).passthrough(),
    }).passthrough();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- WebAuthn library needs its own AuthenticationResponseJSON type
    let credential: any;
    try {
      const body = await request.json();
      const parsed = webAuthnAuthSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid credential data', details: parsed.error.errors },
          { status: 400 }
        );
      }
      credential = body; // Pass original body to preserve library-compatible types
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

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
