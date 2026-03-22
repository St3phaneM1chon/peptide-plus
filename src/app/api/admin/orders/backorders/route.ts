export const dynamic = 'force-dynamic';

/**
 * Backorder Management API
 * GET /api/admin/orders/backorders
 *
 * Lists orders containing items where the product stock is 0 or below the ordered quantity.
 * Useful for identifying orders that need stock replenishment before fulfillment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// GET /api/admin/orders/backorders
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50', 10)), 200);
    const skip = (page - 1) * limit;

    // Find all non-terminal orders that have items referencing out-of-stock products
    // We use a raw query approach: first find products with low/no stock,
    // then find order items referencing those products in active orders.
    const activeStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'PRE_ORDER'];

    // Step 1: Get all products with stock tracking enabled and low/zero stock
    // A7-P2-003: Add take limit to prevent unbounded result sets
    const lowStockProducts = await prisma.product.findMany({
      where: {
        trackInventory: true,
        stockQuantity: { lte: 0 },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        stockQuantity: true,
      },
      take: 1000,
    });

    const lowStockProductIds = lowStockProducts.map((p) => p.id);
    const productStockMap = new Map(lowStockProducts.map((p) => [p.id, p]));

    if (lowStockProductIds.length === 0) {
      return NextResponse.json({
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
        summary: { totalBackorderedOrders: 0, totalBackorderedItems: 0 },
      });
    }

    // Step 2: Find orders with items referencing these products
    // Use a two-step approach for better performance
    // A7-P2-003: Add take limit to prevent unbounded result sets on large order volumes
    const backorderedOrderItems = await prisma.orderItem.findMany({
      where: {
        productId: { in: lowStockProductIds },
        order: {
          status: { in: activeStatuses },
        },
      },
      select: {
        id: true,
        orderId: true,
        productId: true,
        productName: true,
        optionName: true,
        quantity: true,
        unitPrice: true,
      },
      take: 5000,
    });

    // Group by orderId
    const orderItemsMap = new Map<string, typeof backorderedOrderItems>();
    for (const item of backorderedOrderItems) {
      const existing = orderItemsMap.get(item.orderId) || [];
      existing.push(item);
      orderItemsMap.set(item.orderId, existing);
    }

    const backorderedOrderIds = [...orderItemsMap.keys()];
    const total = backorderedOrderIds.length;
    const totalPages = Math.ceil(total / limit);

    // Paginate the order IDs
    const paginatedOrderIds = backorderedOrderIds.slice(skip, skip + limit);

    // Step 3: Fetch full order details for the paginated set
    const orders = paginatedOrderIds.length > 0
      ? await prisma.order.findMany({
          where: { id: { in: paginatedOrderIds } },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            shippingName: true,
            createdAt: true,
            userId: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    // Enrich orders with backordered item details
    const enrichedOrders = orders.map((order) => {
      const items = orderItemsMap.get(order.id) || [];
      return {
        ...order,
        total: Number(order.total),
        backorderedItems: items.map((item) => {
          const productStock = productStockMap.get(item.productId);
          return {
            orderItemId: item.id,
            productId: item.productId,
            productName: item.productName,
            optionName: item.optionName,
            orderedQuantity: item.quantity,
            availableStock: productStock?.stockQuantity ?? 0,
            shortfall: item.quantity - (productStock?.stockQuantity ?? 0),
            unitPrice: Number(item.unitPrice),
          };
        }),
      };
    });

    // Summary statistics
    const totalBackorderedItems = backorderedOrderItems.reduce((sum, item) => sum + item.quantity, 0);

    return NextResponse.json({
      data: enrichedOrders,
      total,
      page,
      limit,
      totalPages,
      summary: {
        totalBackorderedOrders: total,
        totalBackorderedItems,
        outOfStockProducts: lowStockProducts.length,
      },
    });
  } catch (error) {
    logger.error('Backorder listing failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
