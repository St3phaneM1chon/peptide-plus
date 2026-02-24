export const dynamic = 'force-dynamic';

/**
 * Admin Inventory API
 * GET  - List all products with inventory info
 * POST - Receive stock (purchase)
 * PUT  - Adjust stock manually
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { purchaseStock, adjustStock } from '@/lib/inventory';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// Zod schema for POST /api/admin/inventory (receive stock)
const receiveStockSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1, 'productId is required'),
    formatId: z.string().optional(),
    quantity: z.number().int().positive('Quantity must be positive'),
    unitCost: z.number().positive('Unit cost must be greater than zero'),
  })).min(1, 'Items array must not be empty'),
  supplierInvoiceId: z.string().optional(),
}).strict();

// Zod schema for PUT /api/admin/inventory (adjust stock)
const adjustStockSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  formatId: z.string().nullable().optional(),
  quantity: z.number().int().refine((v) => v !== 0, 'Quantity must be non-zero'),
  reason: z.string().min(1, 'Reason is required for stock adjustments'),
}).strict();

// GET /api/admin/inventory - List products with inventory info
export const GET = withAdminGuard(async (request, _ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const lowStockOnly = searchParams.get('lowStock') === 'true';

    // DI-69: Use raw WHERE for low stock filter instead of JS post-filtering
    let lowStockIds: string[] | null = null;
    if (lowStockOnly) {
      const lowStockFormats = await prisma.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "ProductFormat"
        WHERE "isActive" = true
          AND "trackInventory" = true
          AND "stockQuantity" <= "lowStockThreshold"
      `;
      lowStockIds = lowStockFormats.map((f) => f.id);
    }

    const formats = await prisma.productFormat.findMany({
      where: {
        isActive: true,
        trackInventory: true,
        ...(lowStockIds !== null ? { id: { in: lowStockIds } } : {}),
      },
      select: {
        id: true,
        productId: true,
        name: true,
        formatType: true,
        sku: true,
        price: true,
        stockQuantity: true,
        lowStockThreshold: true,
        availability: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            sku: true,
            imageUrl: true,
            isActive: true,
          },
        },
      },
      orderBy: { stockQuantity: 'asc' },
      take: 500, // Safety net: limit inventory list to prevent unbounded queries
    });

    // Batch query: fetch the latest WAC for ALL formats at once
    // Uses raw SQL with DISTINCT ON to get the most recent transaction per (productId, formatId)
    const latestTransactions = await prisma.$queryRaw<
      { productId: string; formatId: string | null; runningWAC: number }[]
    >`
      SELECT DISTINCT ON ("productId", "formatId")
        "productId", "formatId", "runningWAC"
      FROM "InventoryTransaction"
      ORDER BY "productId", "formatId", "createdAt" DESC
    `;

    // Build a lookup map: "productId:formatId" -> runningWAC
    const wacMap = new Map<string, number>();
    for (const tx of latestTransactions) {
      const key = `${tx.productId}:${tx.formatId ?? ''}`;
      wacMap.set(key, Number(tx.runningWAC));
    }

    const inventoryItems = formats.map((format) => {
      const key = `${format.productId}:${format.id}`;
      const wac = wacMap.get(key) ?? 0;

      return {
        formatId: format.id,
        productId: format.productId,
        productName: format.product.name,
        productSlug: format.product.slug,
        productSku: format.product.sku,
        productImageUrl: format.product.imageUrl,
        productActive: format.product.isActive,
        formatName: format.name,
        formatType: format.formatType,
        formatSku: format.sku,
        stockQuantity: format.stockQuantity,
        lowStockThreshold: format.lowStockThreshold,
        isLowStock: format.stockQuantity <= format.lowStockThreshold,
        availability: format.availability,
        wac,
        price: Number(format.price),
      };
    });

    // DI-69: Low stock is already filtered at DB level when lowStockOnly is true
    const result = inventoryItems;

    return NextResponse.json({
      inventory: result,
      total: result.length,
      lowStockCount: inventoryItems.filter((item) => item.isLowStock).length,
    });
  } catch (error) {
    logger.error('Admin inventory GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// POST /api/admin/inventory - Receive stock (purchase)
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();

    // Validate with Zod
    const parsed = receiveStockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const { items, supplierInvoiceId } = parsed.data;

    await purchaseStock(
      items.map((item: Record<string, unknown>) => ({
        productId: item.productId as string,
        formatId: (item.formatId as string) || undefined,
        quantity: item.quantity as number,
        unitCost: item.unitCost as number,
      })),
      supplierInvoiceId || undefined,
      session.user.id
    );

    logAdminAction({
      adminUserId: session.user.id,
      action: 'RECEIVE_STOCK',
      targetType: 'Inventory',
      targetId: supplierInvoiceId || 'bulk',
      newValue: { itemCount: items.length, supplierInvoiceId },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json(
      {
        success: true,
        message: `Stock received for ${items.length} item(s)`,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Admin inventory POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// PUT /api/admin/inventory - Adjust stock manually
export const PUT = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();

    // Validate with Zod
    const parsed = adjustStockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const { productId, formatId, quantity, reason } = parsed.data;

    await adjustStock(
      productId,
      formatId || null,
      quantity,
      reason,
      session.user.id
    );

    logAdminAction({
      adminUserId: session.user.id,
      action: 'ADJUST_STOCK',
      targetType: 'Inventory',
      targetId: productId,
      newValue: { productId, formatId, quantity, reason },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Stock adjusted by ${quantity} for product ${productId}`,
    });
  } catch (error) {
    logger.error('Admin inventory PUT error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
