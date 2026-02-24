export const dynamic = 'force-dynamic';

/**
 * Admin Inventory Item API
 * PATCH - Update stock quantity for a specific ProductFormat
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { adjustStock } from '@/lib/inventory';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// Zod schema for PATCH /api/admin/inventory/[id]
const updateStockSchema = z.object({
  stockQuantity: z
    .number()
    .int('Stock quantity must be an integer')
    .min(0, 'Stock quantity cannot be negative'),
  reason: z
    .string()
    .min(1, 'Reason is required for stock adjustments')
    .max(500, 'Reason must be 500 characters or fewer'),
}).strict();

// PATCH /api/admin/inventory/[id] - Update stock quantity for a ProductFormat
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();

    // Validate with Zod
    const parsed = updateStockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const { stockQuantity, reason } = parsed.data;

    // Verify the ProductFormat exists
    const format = await prisma.productFormat.findUnique({
      where: { id },
      select: {
        id: true,
        productId: true,
        stockQuantity: true,
        name: true,
        availability: true,
        product: { select: { name: true } },
      },
    });

    if (!format) {
      return NextResponse.json(
        { error: 'Product format not found' },
        { status: 404 }
      );
    }

    const previousQuantity = format.stockQuantity;
    const delta = stockQuantity - previousQuantity;

    // Use $transaction to ensure stock adjustment + availability update are atomic
    await prisma.$transaction(async (tx) => {
      // Use the adjustStock service to handle the change
      // (creates InventoryTransaction records and adjusts stock with floor protection)
      if (delta !== 0) {
        await adjustStock(
          format.productId,
          format.id,
          delta,
          reason,
          session.user.id
        );
      }

      // Determine the new availability based on the new stock quantity
      const newAvailability = stockQuantity === 0 ? 'OUT_OF_STOCK' : 'IN_STOCK';

      // Update availability if it changed (only for IN_STOCK / OUT_OF_STOCK transitions)
      // Do NOT override DISCONTINUED, COMING_SOON, PRE_ORDER, or LIMITED statuses
      const shouldUpdateAvailability =
        format.availability === 'IN_STOCK' || format.availability === 'OUT_OF_STOCK';

      if (shouldUpdateAvailability && format.availability !== newAvailability) {
        await tx.productFormat.update({
          where: { id },
          data: { availability: newAvailability },
        });
      }
    });

    // Fetch the updated format to return
    const updated = await prisma.productFormat.findUnique({
      where: { id },
      select: {
        id: true,
        productId: true,
        name: true,
        sku: true,
        price: true,
        stockQuantity: true,
        lowStockThreshold: true,
        availability: true,
        isActive: true,
        product: { select: { name: true, slug: true } },
      },
    });

    // Audit log (fire-and-forget)
    logAdminAction({
      adminUserId: session.user.id,
      action: 'ADJUST_STOCK',
      targetType: 'ProductFormat',
      targetId: id,
      previousValue: { stockQuantity: previousQuantity, availability: format.availability },
      newValue: { stockQuantity, reason, delta },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      format: updated
        ? {
            id: updated.id,
            productId: updated.productId,
            productName: updated.product.name,
            productSlug: updated.product.slug,
            formatName: updated.name,
            sku: updated.sku,
            price: Number(updated.price),
            stockQuantity: updated.stockQuantity,
            lowStockThreshold: updated.lowStockThreshold,
            availability: updated.availability,
            isActive: updated.isActive,
          }
        : null,
    });
  } catch (error) {
    logger.error('Admin inventory PATCH error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
