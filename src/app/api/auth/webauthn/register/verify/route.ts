export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { rpID, origin } from '@/lib/webauthn';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { deviceName, ...credential } = body;

    // Get challenge from cookie
    const cookieStore = await cookies();
    const challenge = cookieStore.get('webauthn-challenge')?.value;

    if (!challenge) {
      return NextResponse.json(
        { error: 'Challenge expired. Please try again.' },
        { status: 400 }
      );
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: 'Verification failed' },
        { status: 400 }
      );
    }

    const { credential: registeredCredential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    // Store credential in database
    await prisma.authenticator.create({
      data: {
        credentialID: Buffer.from(registeredCredential.id).toString('base64url'),
        userId: session.user.id,
        credentialPublicKey: Buffer.from(registeredCredential.publicKey).toString('base64url'),
        counter: registeredCredential.counter,
        credentialDeviceType,
        credentialBackedUp,
        transports: credential.response.transports?.join(',') || null,
        deviceName: deviceName || null,
      },
    });

    // Clear challenge cookie
    cookieStore.delete('webauthn-challenge');

    return NextResponse.json({ verified: true });
  } catch (error) {
    logger.error('WebAuthn register verify error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}
