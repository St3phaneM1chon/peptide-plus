export const dynamic = 'force-dynamic';

/**
 * Admin Media Library API
 * GET - List media files with pagination and filtering
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
    const search = searchParams.get('search');
    const type = searchParams.get('type');

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { filename: { contains: search, mode: 'insensitive' } },
        { alt: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (type) {
      where.mimeType = { startsWith: type };
    }

    const [data, total] = await Promise.all([
      prisma.media.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.media.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    logger.error('Admin media library GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
