export const dynamic = 'force-dynamic';

/**
 * Admin Newsletter Subscribers API
 * GET - List all newsletter subscribers (from NewsletterSubscriber)
 *
 * FIX: FLAW-002 - These routes were missing; the admin page fetched from them but they didn't exist.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (request: NextRequest, { session: _session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '200', 10)), 500);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status === 'ACTIVE') where.isActive = true;
    else if (status === 'UNSUBSCRIBED') where.unsubscribedAt = { not: null };

    const [subscribers, total] = await Promise.all([
      prisma.newsletterSubscriber.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          locale: true,
          source: true,
          isActive: true,
          subscribedAt: true,
          unsubscribedAt: true,
        },
        orderBy: { subscribedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.newsletterSubscriber.count({ where }),
    ]);

    const formatted = subscribers.map((sub) => ({
      id: sub.id,
      email: sub.email,
      name: sub.name,
      locale: sub.locale || 'fr',
      source: sub.source || 'website',
      status: sub.unsubscribedAt
        ? 'UNSUBSCRIBED'
        : sub.isActive
          ? 'ACTIVE'
          : 'BOUNCED',
      subscribedAt: sub.subscribedAt.toISOString(),
      unsubscribedAt: sub.unsubscribedAt?.toISOString() || null,
    }));

    return NextResponse.json({
      subscribers: formatted,
      total,
      page,
      limit,
    });
  } catch (error) {
    logger.error('Admin newsletter subscribers error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to fetch subscribers', subscribers: [] },
      { status: 500 }
    );
  }
});
