export const dynamic = 'force-dynamic';

/**
 * Admin Newsletter Subscribers Clean Bounces API
 * POST - Remove/deactivate bounced subscribers
 *
 * FIX: SECURITY - This route was missing, causing 404 when admins tried to clean bounced contacts.
 * Protected by withAdminGuard (auth + role + CSRF + rate limiting).
 */

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/newsletter/subscribers/clean-bounces
 * Deactivates all subscribers that are marked as inactive (bounced).
 * Returns: { removed: number }
 */
export const POST = withAdminGuard(async (_request, { session: _session }) => {
  try {
    // Find bounced subscribers: inactive and not already unsubscribed
    const bounced = await prisma.newsletterSubscriber.findMany({
      where: {
        isActive: false,
        unsubscribedAt: null,
      },
      select: { id: true },
    });

    if (bounced.length === 0) {
      return NextResponse.json({ removed: 0, message: 'No bounced contacts found' });
    }

    // Mark bounced subscribers as unsubscribed (soft delete)
    const result = await prisma.newsletterSubscriber.updateMany({
      where: {
        id: { in: bounced.map((b) => b.id) },
      },
      data: {
        unsubscribedAt: new Date(),
      },
    });

    logger.info('Cleaned bounced newsletter subscribers', {
      removed: result.count,
    });

    return NextResponse.json({
      removed: result.count,
    });
  } catch (error) {
    logger.error('Admin newsletter clean bounces error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to clean bounced subscribers' },
      { status: 500 }
    );
  }
});
