export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { rpID, origin } from '@/lib/webauthn';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limit WebAuthn registration verification attempts
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/auth/register');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // INPUT-01 FIX: Zod validation for WebAuthn registration credential
    // Note: We use passthrough() because the WebAuthn library expects its own
    // RegistrationResponseJSON type with specific union fields like
    // authenticatorAttachment. We validate the required structure but let
    // additional/typed fields pass through to the library for deep validation.
    const webAuthnRegisterSchema = z.object({
      id: z.string().min(1),
      rawId: z.string().min(1),
      type: z.literal('public-key'),
      response: z.object({
        attestationObject: z.string().min(1),
        clientDataJSON: z.string().min(1),
        transports: z.array(z.string()).optional(),
      }).passthrough(),
      deviceName: z.string().max(200).optional().nullable(),
    }).passthrough();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- WebAuthn library needs its own RegistrationResponseJSON type
    let rawBody: any;
    try {
      rawBody = await request.json();
      const parsed = webAuthnRegisterSchema.safeParse(rawBody);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid credential data', details: parsed.error.errors },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // Extract deviceName and pass the rest to the library as-is for type compatibility
    const { deviceName, ...credential } = rawBody;

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

    const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    // Store credential in database
    await prisma.authenticator.create({
      data: {
        credentialID: Buffer.from(credentialID).toString('base64url'),
        userId: session.user.id,
        credentialPublicKey: Buffer.from(credentialPublicKey).toString('base64url'),
        counter,
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
