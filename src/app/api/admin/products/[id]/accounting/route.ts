export const dynamic = 'force-dynamic';

/**
 * Bridge #54: Catalog -> Accounting (Product revenue & journal entries)
 * GET /api/admin/products/[id]/accounting
 *
 * Shows accounting entries (journal lines) related to orders containing
 * this product, giving a revenue/cost breakdown per product.
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { isModuleEnabled } from '@/lib/module-flags';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  try {
    const enabled = await isModuleEnabled('accounting');
    if (!enabled) return apiSuccess({ enabled: false }, { request });

    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, name: true, price: true, sku: true },
    });

    if (!product) {
      return apiError('Product not found', ErrorCode.NOT_FOUND, { request });
    }

    // Find orders containing this product
    const orderItems = await prisma.orderItem.findMany({
      where: { productId: id },
      select: { orderId: true, quantity: true, unitPrice: true, total: true },
    });

    const orderIds = [...new Set(orderItems.map((oi) => oi.orderId))];

    // Find journal entries linked to these orders
    const entries = await prisma.journalEntry.findMany({
      where: {
        orderId: { in: orderIds },
        deletedAt: null,
      },
      take: 20,
      orderBy: { date: 'desc' },
      select: {
        id: true,
        entryNumber: true,
        date: true,
        description: true,
        type: true,
        status: true,
        lines: {
          select: {
            id: true,
            debit: true,
            credit: true,
            description: true,
          },
        },
      },
    });

    // Calculate totals
    const totalRevenue = orderItems.reduce(
      (sum, oi) => sum + Number(oi.total),
      0
    );
    const totalUnits = orderItems.reduce((sum, oi) => sum + oi.quantity, 0);

    let totalDebit = 0;
    let totalCredit = 0;
    for (const entry of entries) {
      for (const line of entry.lines) {
        totalDebit += Number(line.debit);
        totalCredit += Number(line.credit);
      }
    }

    return apiSuccess({
      enabled: true,
      product: {
        id: product.id,
        name: product.name,
        price: Number(product.price),
        sku: product.sku,
      },
      revenue: {
        totalRevenue,
        totalUnits,
        totalOrders: orderIds.length,
      },
      accounting: {
        entries: entries.map((e) => ({
          id: e.id,
          entryNumber: e.entryNumber,
          date: e.date,
          description: e.description,
          type: e.type,
          status: e.status,
          lineCount: e.lines.length,
        })),
        totalDebit,
        totalCredit,
        entryCount: entries.length,
      },
    }, { request });
  } catch (error) {
    logger.error('[products/[id]/accounting] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch accounting data', ErrorCode.INTERNAL_ERROR, { request });
  }
});
