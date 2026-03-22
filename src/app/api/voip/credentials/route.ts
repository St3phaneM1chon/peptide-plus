export const dynamic = 'force-dynamic';

/**
 * VoIP SIP Credentials API
 *
 * GET /api/voip/credentials — Returns SIP credentials + caller ID for the authenticated user.
 * Used by the iOS app (VoIPAPIClient) to connect to Telnyx WebRTC.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find the user's SIP extension
    const sipExtension = await prisma.sipExtension.findFirst({
      where: { userId: session.user.id },
      select: {
        extension: true,
        sipUsername: true,
        sipPassword: true,
        sipDomain: true,
      },
    });

    if (!sipExtension) {
      return NextResponse.json(
        { error: 'No SIP extension configured for this user' },
        { status: 404 }
      );
    }

    // Find the primary phone number to use as caller ID
    // Priority: user's assigned number > company main number > default
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: { isActive: true },
      orderBy: { type: 'asc' }, // LOCAL before TOLL_FREE
      select: { number: true, displayName: true },
    });

    const callerIdNumber = phoneNumber?.number || process.env.TELNYX_DEFAULT_CALLER_ID || '+14388030370';
    const callerIdName = phoneNumber?.displayName || 'Attitudes VIP';

    logger.info('[VoIP Credentials] Served credentials', {
      userId: session.user.id,
      extension: sipExtension.extension,
    });

    return NextResponse.json({
      data: {
        sipUser: sipExtension.sipUsername,
        sipPassword: sipExtension.sipPassword,
        callerIdNumber,
        callerIdName,
      },
    });
  } catch (error) {
    logger.error('[VoIP Credentials] Failed', {
      error: error instanceof Error ? error.message : String(error),
      userId: session.user.id,
    });
    return NextResponse.json(
      { error: 'Failed to fetch credentials' },
      { status: 500 }
    );
  }
}
