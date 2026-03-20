export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withMobileGuard } from '@/lib/mobile-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const DELETE = withMobileGuard(async (_request, { session }) => {
  try {
    // Soft delete: anonymize user data instead of hard delete (RGPD/GDPR)
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        email: `deleted-${session.user.id}@deleted.local`,
        name: 'Compte supprime',
        phone: null,
        image: null,
        password: null,
        mfaEnabled: false,
        mfaSecret: null,
        isBanned: true,
        bannedAt: new Date(),
        bannedReason: 'Account deleted by user',
      },
    });

    logger.info('[Auth] Account deleted', { userId: session.user.id });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Auth] Account deletion failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Deletion failed' },
      { status: 500 }
    );
  }
});
