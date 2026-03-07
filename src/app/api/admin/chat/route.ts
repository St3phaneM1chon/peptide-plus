export const dynamic = 'force-dynamic';

/**
 * Admin Chat API
 * GET - List chat conversations with pagination
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const skip = (page - 1) * limit;
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }

    const [data, total] = await Promise.all([
      prisma.chatConversation.findMany({
        where,
        take: limit,
        skip,
        orderBy: { updatedAt: 'desc' },
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      prisma.chatConversation.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    logger.error('Admin chat GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
