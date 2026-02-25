export const dynamic = 'force-dynamic';

/**
 * Admin Bulk Price Update API
 * POST - Adjust all product format prices by a percentage
 *
 * Body:
 *   percentage: number (1-100)
 *   direction: 'increase' | 'decrease'
 *   categoryFilter?: string (category slug to filter)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

const bulkPriceSchema = z.object({
  percentage: z.number().min(0.1).max(100),
  direction: z.enum(['increase', 'decrease']),
  categoryFilter: z.string().optional(),
});

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = bulkPriceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { percentage, direction, categoryFilter } = parsed.data;
    const multiplier = direction === 'increase'
      ? 1 + (percentage / 100)
      : 1 - (percentage / 100);

    // Build product filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const productWhere: any = {};
    if (categoryFilter) {
      productWhere.category = { slug: categoryFilter };
    }

    // Get all product IDs matching the filter
    const products = await prisma.product.findMany({
      where: productWhere,
      select: { id: true },
    });

    const productIds = products.map(p => p.id);

    if (productIds.length === 0) {
      return NextResponse.json({ updated: 0, message: 'No products found matching filter' });
    }

    // Update all active formats for these products
    const result = await prisma.productFormat.updateMany({
      where: {
        productId: { in: productIds },
        isActive: true,
      },
      data: {
        price: {
          multiply: multiplier,
        },
      },
    });

    // Also update the base product prices
    await prisma.product.updateMany({
      where: {
        id: { in: productIds },
      },
      data: {
        price: {
          multiply: multiplier,
        },
      },
    });

    logger.info('Bulk price update', {
      direction,
      percentage,
      categoryFilter: categoryFilter || 'all',
      productsAffected: productIds.length,
      formatsUpdated: result.count,
    });

    return NextResponse.json({
      updated: productIds.length,
      formatsUpdated: result.count,
      direction,
      percentage,
    });
  } catch (error) {
    logger.error('Bulk price update error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
