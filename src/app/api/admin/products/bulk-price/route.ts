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
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const bulkPriceSchema = z.object({
  percentage: z.number().min(0.1).max(100),
  direction: z.enum(['increase', 'decrease']),
  categoryFilter: z.string().optional(),
  dryRun: z.boolean().optional(),
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();
    const parsed = bulkPriceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { percentage, direction, categoryFilter, dryRun } = parsed.data;
    const multiplier = direction === 'increase'
      ? 1 + (percentage / 100)
      : 1 - (percentage / 100);

    // Build product filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const productWhere: any = {};
    if (categoryFilter) {
      productWhere.category = { slug: categoryFilter };
    }

    // Get all products matching the filter with current prices
    const products = await prisma.product.findMany({
      where: productWhere,
      select: { id: true, name: true, price: true },
    });

    const productIds = products.map(p => p.id);

    if (productIds.length === 0) {
      return NextResponse.json({ updated: 0, message: 'No products found matching filter' });
    }

    // Get all active formats for preview
    const formats = await prisma.productFormat.findMany({
      where: { productId: { in: productIds }, isActive: true },
      select: { id: true, name: true, price: true, productId: true },
    });

    // Dry run: return preview without modifying anything
    if (dryRun) {
      const preview = products.map(p => ({
        id: p.id,
        name: p.name,
        currentPrice: Number(p.price),
        newPrice: Math.round(Number(p.price) * multiplier * 100) / 100,
        formats: formats
          .filter(f => f.productId === p.id)
          .map(f => ({
            id: f.id,
            name: f.name,
            currentPrice: Number(f.price),
            newPrice: Math.round(Number(f.price) * multiplier * 100) / 100,
          })),
      }));

      return NextResponse.json({
        dryRun: true,
        direction,
        percentage,
        productsAffected: products.length,
        formatsAffected: formats.length,
        preview,
      });
    }

    // Use a transaction to ensure format + product price updates are atomic
    const result = await prisma.$transaction(async (tx) => {
      // Update all active formats for these products
      const formatResult = await tx.productFormat.updateMany({
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
      await tx.product.updateMany({
        where: {
          id: { in: productIds },
        },
        data: {
          price: {
            multiply: multiplier,
          },
        },
      });

      return formatResult;
    });

    // CATALOGUE-002 FIX: Audit log for bulk price changes (critical operation)
    const priceChangeSummary = {
      direction,
      percentage,
      multiplier,
      categoryFilter: categoryFilter || 'all',
      productsAffected: productIds.length,
      formatsUpdated: result.count,
      sampleChanges: products.slice(0, 5).map(p => ({
        id: p.id,
        name: p.name,
        oldPrice: Number(p.price),
        newPrice: Math.round(Number(p.price) * multiplier * 100) / 100,
      })),
    };

    logAdminAction({
      adminUserId: session.user.id,
      action: 'BULK_PRICE_UPDATE',
      targetType: 'Product',
      targetId: `bulk-${productIds.length}-products`,
      newValue: priceChangeSummary,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch((err) => { logger.error('[admin/products/bulk-price] Non-blocking operation failed:', err); });

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
