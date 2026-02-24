/**
 * GET /api/admin/audits/catalog - Browse function catalog
 * Query params: ?type=api_handler&search=xxx&page=1&limit=50
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get('type');
    const search = searchParams.get('search');
    const status = searchParams.get('status') || 'ACTIVE';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const where: Record<string, unknown> = { status };
    if (typeFilter) where.type = typeFilter;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { filePath: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [functions, total, typeCounts] = await Promise.all([
      prisma.auditFunction.findMany({
        where,
        orderBy: [{ type: 'asc' }, { filePath: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditFunction.count({ where }),
      prisma.auditFunction.groupBy({
        by: ['type'],
        where: { status },
        _count: { type: true },
      }),
    ]);

    return NextResponse.json({
      data: {
        functions,
        typeCounts: typeCounts.reduce((acc, t) => {
          acc[t.type] = t._count.type;
          return acc;
        }, {} as Record<string, number>),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: unknown) {
    logger.error('Error fetching audit catalog:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { skipCsrf: true });
