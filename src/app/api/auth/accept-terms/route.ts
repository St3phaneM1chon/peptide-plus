export const dynamic = 'force-dynamic';

/**
 * Accept Terms of Service API
 * POST - Record user's acceptance of Terms of Service and Privacy Policy
 *
 * RGPD/PIPEDA compliance: stores explicit consent with timestamp and version.
 * Used primarily for OAuth signups that bypass the regular signup form.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { termsVersion, privacyVersion } = body;

    if (!termsVersion) {
      return NextResponse.json(
        { error: 'termsVersion is required' },
        { status: 400 }
      );
    }

    const now = new Date();

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        termsAcceptedAt: now,
        termsVersion: termsVersion || '1.0',
        privacyAcceptedAt: now,
      },
    });

    console.log(
      JSON.stringify({
        event: 'terms_accepted',
        timestamp: now.toISOString(),
        userId: session.user.id,
        email: session.user.email,
        termsVersion,
        privacyVersion: privacyVersion || termsVersion,
      })
    );

    return NextResponse.json({
      success: true,
      acceptedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('Accept terms error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
