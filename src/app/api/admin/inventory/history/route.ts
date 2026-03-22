export const dynamic = 'force-dynamic';

/**
 * Admin Inventory Transaction History API
 * GET - List inventory transactions with filtering
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

// GET /api/admin/inventory/history - Inventory transaction history
export const GET = withAdminGuard(async (request, _ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const optionId = searchParams.get('optionId');
    const type = searchParams.get('type');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50', 10)), 200);
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (productId) {
      where.productId = productId;
    }

    if (optionId) {
      where.optionId = optionId;
    }

    if (type) {
      const validTypes = ['PURCHASE', 'SALE', 'ADJUSTMENT', 'RETURN', 'LOSS'];
      if (validTypes.includes(type)) {
        where.type = type;
      } else {
        return NextResponse.json(
          { error: `Invalid type filter. Must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }
    }

    const [transactions, total] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.inventoryTransaction.count({ where }),
    ]);

    // Enrich with product/format names if needed
    const productIds = [...new Set(transactions.map((t) => t.productId))];
    const optionIds = [...new Set(transactions.filter((t) => t.optionId).map((t) => t.optionId as string))];

    const [products, options] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, sku: true },
      }),
      optionIds.length > 0
        ? prisma.productOption.findMany({
            where: { id: { in: optionIds } },
            select: { id: true, name: true, sku: true },
          })
        : [],
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const formatMap = new Map(options.map((f) => [f.id, f]));

    const enrichedTransactions = transactions.map((t) => {
      const product = productMap.get(t.productId);
      const format = t.optionId ? formatMap.get(t.optionId) : null;
      return {
        id: t.id,
        productId: t.productId,
        productName: product?.name || 'Unknown',
        productSku: product?.sku || null,
        optionId: t.optionId,
        optionName: format?.name || null,
        formatSku: format?.sku || null,
        type: t.type,
        quantity: t.quantity,
        unitCost: Number(t.unitCost),
        runningWAC: Number(t.runningWAC),
        orderId: t.orderId,
        supplierInvoiceId: t.supplierInvoiceId,
        reason: t.reason,
        createdBy: t.createdBy,
        createdAt: t.createdAt,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: enrichedTransactions,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    logger.error('Admin inventory history error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
