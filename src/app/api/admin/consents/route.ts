export const dynamic = 'force-dynamic';

/**
 * Admin Consents API - Centralized consent tracking
 * GET - List all site consents with advanced filters
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

// GET /api/admin/consents
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const clientId = searchParams.get('clientId');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (clientId) where.clientId = clientId;

    if (search) {
      where.OR = [
        { client: { name: { contains: search, mode: 'insensitive' } } },
        { client: { email: { contains: search, mode: 'insensitive' } } },
        { video: { title: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [consents, total] = await Promise.all([
      prisma.siteConsent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          client: { select: { id: true, name: true, email: true } },
          video: { select: { id: true, title: true, slug: true, thumbnailUrl: true } },
          formTemplate: { select: { id: true, name: true } },
          requestedBy: { select: { id: true, name: true } },
        },
      }),
      prisma.siteConsent.count({ where }),
    ]);

    // Stats — grouped in single query instead of 4 separate counts
    const statusGroups = await prisma.siteConsent.groupBy({
      by: ['status'],
      _count: { id: true },
    });
    const statusMap: Record<string, number> = {};
    let totalCount = 0;
    for (const g of statusGroups) {
      statusMap[g.status] = g._count.id;
      totalCount += g._count.id;
    }

    return NextResponse.json({
      consents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
      stats: {
        pending: statusMap['PENDING'] || 0,
        granted: statusMap['GRANTED'] || 0,
        revoked: statusMap['REVOKED'] || 0,
        total: totalCount,
      },
    });
  } catch (error) {
    logger.error('Admin consents GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
