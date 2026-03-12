export const dynamic = 'force-dynamic';

/**
 * Admin Products API
 * GET - List products with pagination and search
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
    const categoryId = searchParams.get('categoryId');
    const active = searchParams.get('active');

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (active !== null && active !== undefined && active !== '') {
      where.isActive = active === 'true';
    }

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          price: true,
          compareAtPrice: true,
          imageUrl: true,
          isActive: true,
          isFeatured: true,
          categoryId: true,
          createdAt: true,
          updatedAt: true,
          category: { select: { id: true, name: true } },
          images: {
            take: 1,
            orderBy: { sortOrder: 'asc' },
            select: { id: true, url: true, alt: true, sortOrder: true },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    logger.error('Admin products GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
