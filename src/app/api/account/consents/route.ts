export const dynamic = 'force-dynamic';

/**
 * Account Consents API
 * GET - List consents for the authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withUserGuard } from '@/lib/user-api-guard';
import { logger } from '@/lib/logger';

// GET /api/account/consents
export const GET = withUserGuard(async (request: NextRequest, { session }) => {
  try {

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    const [consents, total] = await Promise.all([
      prisma.siteConsent.findMany({
        where: { clientId: session.user.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
        include: {
          video: { select: { id: true, title: true, slug: true, thumbnailUrl: true } },
          formTemplate: { select: { id: true, name: true } },
        },
      }),
      prisma.siteConsent.count({ where: { clientId: session.user.id } }),
    ]);

    return NextResponse.json({
      consents,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('Account consents GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { skipCsrf: true });
