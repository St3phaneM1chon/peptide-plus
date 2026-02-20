export const dynamic = 'force-dynamic';

/**
 * Admin Orders API
 * GET  - List orders with filtering, pagination, and search
 * PUT  - Update order status, tracking, admin notes
 * POST - Batch update order statuses (item 71)
 *
 * TODO (item 76): Add order split/combine API endpoints:
 *   - POST /api/admin/orders/[id]/split  - Split multi-item order into separate orders
 *     for partial fulfillment (e.g., ship available items now, backorder the rest).
 *     Should create child orders linked via parentOrderId, move selected OrderItems,
 *     recalculate totals/tax proportionally, and create inventory transactions.
 *   - POST /api/admin/orders/[id]/combine - Combine multiple orders from the same
 *     customer into a single shipment. Requires same shipping address validation,
 *     merging items, recalculating shipping costs, and updating accounting entries.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { sendOrderLifecycleEmail } from '@/lib/email';
import { apiSuccess, apiError, apiPaginated } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { updateOrderStatusSchema, batchOrderUpdateSchema } from '@/lib/validations/order';

// GET /api/admin/orders - List orders with filtering
export const GET = withAdminGuard(async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const paymentStatus = searchParams.get('paymentStatus');
    const search = searchParams.get('search');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    if (search) {
      where.orderNumber = { contains: search, mode: 'insensitive' };
    }

    if (from || to) {
      where.createdAt = {};
      if (from) {
        (where.createdAt as Record<string, unknown>).gte = new Date(from);
      }
      if (to) {
        // Set to end of the day
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        (where.createdAt as Record<string, unknown>).lte = toDate;
      }
    }

    const [rawOrders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          orderNumber: true,
          userId: true,
          status: true,
          paymentStatus: true,
          subtotal: true,
          shippingCost: true,
          discount: true,
          tax: true,
          taxTps: true,
          taxTvq: true,
          taxTvh: true,
          total: true,
          promoCode: true,
          shippingName: true,
          shippingAddress1: true,
          shippingCity: true,
          shippingState: true,
          shippingPostal: true,
          shippingCountry: true,
          carrier: true,
          trackingNumber: true,
          adminNotes: true,
          orderType: true,
          parentOrderId: true,
          createdAt: true,
          user: {
            select: { name: true, email: true },
          },
          items: {
            select: {
              id: true,
              productName: true,
              formatName: true,
              sku: true,
              quantity: true,
              unitPrice: true,
              discount: true,
              total: true,
            },
          },
          currency: {
            select: { code: true, symbol: true },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    // Serialize Decimal fields to numbers and flatten nested relations
    const orders = rawOrders.map((o) => ({
      ...o,
      subtotal: Number(o.subtotal),
      shippingCost: Number(o.shippingCost),
      discount: Number(o.discount),
      tax: Number(o.tax),
      taxTps: Number(o.taxTps),
      taxTvq: Number(o.taxTvq),
      taxTvh: Number(o.taxTvh),
      total: Number(o.total),
      userName: o.user?.name || o.shippingName,
      userEmail: o.user?.email || '',
      currencyCode: o.currency?.code || 'CAD',
      items: o.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        total: Number(item.total),
      })),
    }));

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Admin orders GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// PUT /api/admin/orders - Update order status
export const PUT = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const { orderId, status, trackingNumber, carrier, adminNotes } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId is required' },
        { status: 400 }
      );
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Validate status transitions
    const validStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (status) {
      updateData.status = status;
    }

    if (trackingNumber !== undefined) {
      updateData.trackingNumber = trackingNumber;
    }

    if (carrier !== undefined) {
      updateData.carrier = carrier;
    }

    if (adminNotes !== undefined) {
      updateData.adminNotes = adminNotes;
    }

    // Set timestamps based on status
    if (status === 'SHIPPED' && !existingOrder.shippedAt) {
      updateData.shippedAt = new Date();
    }

    if (status === 'DELIVERED' && !existingOrder.deliveredAt) {
      updateData.deliveredAt = new Date();
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        items: true,
        currency: { select: { code: true, symbol: true } },
      },
    });

    return NextResponse.json({ order });
  } catch (error) {
    console.error('Admin orders PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// POST /api/admin/orders - Batch update order statuses (item 71)
// Allows admin to update multiple orders at once (e.g., mark batch as SHIPPED)
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const { orders } = body;

    // Validate input
    if (!Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json(
        { error: 'orders must be a non-empty array of { orderId, status, trackingNumber?, carrier?, adminNotes? }' },
        { status: 400 }
      );
    }

    // Cap batch size to prevent abuse
    const MAX_BATCH_SIZE = 50;
    if (orders.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} orders` },
        { status: 400 }
      );
    }

    const validStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

    // Validate all entries before processing
    for (const entry of orders) {
      if (!entry.orderId) {
        return NextResponse.json(
          { error: 'Each entry must have an orderId' },
          { status: 400 }
        );
      }
      if (entry.status && !validStatuses.includes(entry.status)) {
        return NextResponse.json(
          { error: `Invalid status "${entry.status}" for order ${entry.orderId}. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Valid state transitions
    const VALID_TRANSITIONS: Record<string, string[]> = {
      'PENDING': ['CONFIRMED', 'CANCELLED'],
      'CONFIRMED': ['PROCESSING', 'CANCELLED'],
      'PROCESSING': ['SHIPPED', 'CANCELLED'],
      'SHIPPED': ['DELIVERED', 'RETURNED'],
      'DELIVERED': ['RETURNED', 'REFUNDED'],
      'RETURNED': ['REFUNDED'],
      'CANCELLED': [],
      'REFUNDED': [],
    };

    const results: Array<{
      orderId: string;
      orderNumber?: string;
      success: boolean;
      previousStatus?: string;
      newStatus?: string;
      error?: string;
    }> = [];

    // Fetch all orders at once to avoid N+1
    const orderIds = orders.map((o: { orderId: string }) => o.orderId);
    const existingOrders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, orderNumber: true, status: true, shippedAt: true, deliveredAt: true },
    });
    const orderMap = new Map(existingOrders.map((o) => [o.id, o]));

    // Process each order update
    for (const entry of orders) {
      const { orderId, status, trackingNumber, carrier, adminNotes } = entry;

      try {
        const existingOrder = orderMap.get(orderId);
        if (!existingOrder) {
          results.push({ orderId, success: false, error: 'Order not found' });
          continue;
        }

        // Validate state transition
        if (status && status !== existingOrder.status) {
          const allowedNextStatuses = VALID_TRANSITIONS[existingOrder.status] || [];
          if (!allowedNextStatuses.includes(status)) {
            results.push({
              orderId,
              orderNumber: existingOrder.orderNumber,
              success: false,
              previousStatus: existingOrder.status,
              error: `Invalid transition: ${existingOrder.status} -> ${status}`,
            });
            continue;
          }
        }

        const updateData: Record<string, unknown> = {};
        if (status !== undefined) updateData.status = status;
        if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
        if (carrier !== undefined) updateData.carrier = carrier;
        if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

        if (status === 'SHIPPED' && !existingOrder.shippedAt) {
          updateData.shippedAt = new Date();
        }
        if (status === 'DELIVERED' && !existingOrder.deliveredAt) {
          updateData.deliveredAt = new Date();
        }

        await prisma.order.update({
          where: { id: orderId },
          data: updateData,
        });

        // Send lifecycle email on status change (fire-and-forget)
        if (status && status !== existingOrder.status) {
          const validEmailEvents = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
          if (validEmailEvents.includes(status)) {
            sendOrderLifecycleEmail(
              orderId,
              status as 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED',
              { trackingNumber: trackingNumber || undefined, carrier: carrier || undefined },
            ).catch((err) => {
              console.error(`Failed to send ${status} email for order ${orderId}:`, err);
            });
          }
        }

        results.push({
          orderId,
          orderNumber: existingOrder.orderNumber,
          success: true,
          previousStatus: existingOrder.status,
          newStatus: status || existingOrder.status,
        });
      } catch (error) {
        results.push({
          orderId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: failCount === 0,
      summary: {
        total: orders.length,
        succeeded: successCount,
        failed: failCount,
      },
      results,
    });
  } catch (error) {
    console.error('Admin orders batch POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
