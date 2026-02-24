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

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { sendOrderLifecycleEmail } from '@/lib/email';
import { handleEvent } from '@/lib/email/automation-engine';

import { updateOrderStatusSchema, batchOrderUpdateSchema } from '@/lib/validations/order';
import { logger } from '@/lib/logger';

// Shared validation error helper
function validationError(parsed: { error: { flatten: () => unknown } }) {
  return NextResponse.json(
    { error: 'Validation error', details: parsed.error.flatten() },
    { status: 400 }
  );
}

// GET /api/admin/orders - List orders with filtering
export const GET = withAdminGuard(async (request, _ctx) => {
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
    logger.error('Admin orders GET error', { error: error instanceof Error ? error.message : String(error) });
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

    // Validate orderId separately (required for lookup)
    const { orderId, ...rest } = body;
    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json(
        { error: 'orderId is required and must be a string' },
        { status: 400 }
      );
    }

    // Validate the update fields with Zod
    const parsed = updateOrderStatusSchema.safeParse(rest);
    if (!parsed.success) {
      return validationError(parsed);
    }
    const { status, trackingNumber, carrier, adminNotes } = parsed.data;

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // BE-PAY-09 + PAY-005: Order state machine - validate transitions
    const VALID_TRANSITIONS: Record<string, string[]> = {
      'PENDING': ['CONFIRMED', 'PROCESSING', 'CANCELLED'],
      'CONFIRMED': ['PROCESSING', 'CANCELLED'],
      'PROCESSING': ['SHIPPED', 'CANCELLED'],
      'SHIPPED': ['DELIVERED', 'RETURNED'],
      'DELIVERED': ['RETURNED', 'REFUNDED'],
      'CANCELLED': [],   // Terminal state
      'RETURNED': ['REFUNDED'],
      'REFUNDED': [],    // Terminal state
    };

    const validStatuses = Object.keys(VALID_TRANSITIONS);
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate state transition if status is changing
    if (status && status !== existingOrder.status) {
      const allowedNextStatuses = VALID_TRANSITIONS[existingOrder.status] || [];
      if (!allowedNextStatuses.includes(status)) {
        return NextResponse.json(
          {
            error: `Invalid status transition: ${existingOrder.status} -> ${status}. ` +
              `Allowed transitions from ${existingOrder.status}: ${allowedNextStatuses.length > 0 ? allowedNextStatuses.join(', ') : 'none (terminal state)'}`,
          },
          { status: 400 }
        );
      }
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

    // Audit log for order update (fire-and-forget)
    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_ORDER',
      targetType: 'Order',
      targetId: orderId,
      previousValue: { status: existingOrder.status },
      newValue: { status: status || existingOrder.status, trackingNumber: trackingNumber || null, carrier: carrier || null, adminNotes: adminNotes || null },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    // Trigger automation engine for order lifecycle events (fire-and-forget)
    if (status && status !== existingOrder.status) {
      const automationMap: Record<string, string> = {
        SHIPPED: 'order.shipped',
        DELIVERED: 'order.delivered',
      };
      const triggerEvent = automationMap[status];
      if (triggerEvent) {
        const user = await prisma.user.findUnique({
          where: { id: order.userId },
          select: { email: true, name: true },
        });
        if (user) {
          handleEvent(triggerEvent as Parameters<typeof handleEvent>[0], {
            email: user.email,
            name: user.name || undefined,
            userId: order.userId,
            orderId: order.id,
            orderNumber: order.orderNumber,
            trackingNumber: trackingNumber || order.trackingNumber || '',
            carrier: carrier || order.carrier || '',
          }).catch((err) => {
            logger.error(`[AutomationEngine] Failed to handle ${triggerEvent}`, { error: err instanceof Error ? err.message : String(err) });
          });
        }
      }
    }

    return NextResponse.json({ order });
  } catch (error) {
    logger.error('Admin orders PUT error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// POST /api/admin/orders - Batch update order statuses (item 71)
// Allows admin to update multiple orders at once (e.g., mark batch as SHIPPED)
// G1-FLAW-01: PATCH alias for PUT (frontend compatibility)
export const PATCH = PUT;

export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();

    // Validate with Zod schema
    const parsed = batchOrderUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed);
    }
    const { orders } = parsed.data;

    // PAY-005: Valid state transitions (must match single-order handler)
    const VALID_TRANSITIONS: Record<string, string[]> = {
      'PENDING': ['CONFIRMED', 'PROCESSING', 'CANCELLED'],
      'CONFIRMED': ['PROCESSING', 'CANCELLED'],
      'PROCESSING': ['SHIPPED', 'CANCELLED'],
      'SHIPPED': ['DELIVERED', 'RETURNED'],
      'DELIVERED': ['RETURNED', 'REFUNDED'],
      'CANCELLED': [],   // Terminal state
      'RETURNED': ['REFUNDED'],
      'REFUNDED': [],    // Terminal state
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
              logger.error(`Failed to send ${status} email for order ${orderId}`, { error: err instanceof Error ? err.message : String(err) });
            });
          }

          // Trigger automation engine for order lifecycle events (fire-and-forget)
          const automationMap: Record<string, string> = {
            SHIPPED: 'order.shipped',
            DELIVERED: 'order.delivered',
          };
          const triggerEvent = automationMap[status];
          if (triggerEvent) {
            prisma.order.findUnique({
              where: { id: orderId },
              select: { userId: true, orderNumber: true, trackingNumber: true, carrier: true, user: { select: { email: true, name: true } } },
            }).then((o) => {
              if (o?.user) {
                handleEvent(triggerEvent as Parameters<typeof handleEvent>[0], {
                  email: o.user.email,
                  name: o.user.name || undefined,
                  userId: o.userId,
                  orderId,
                  orderNumber: o.orderNumber,
                  trackingNumber: o.trackingNumber || '',
                  carrier: o.carrier || '',
                }).catch(() => {});
              }
            }).catch(() => {});
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

    // Audit log for batch order update (fire-and-forget, one entry for the whole batch)
    logAdminAction({
      adminUserId: session.user.id,
      action: 'BATCH_UPDATE_ORDERS',
      targetType: 'Order',
      targetId: `batch_${orders.length}`,
      newValue: { totalOrders: orders.length, succeeded: successCount, failed: failCount },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: { results: results.map((r) => ({ orderId: r.orderId, orderNumber: r.orderNumber, success: r.success, previousStatus: r.previousStatus, newStatus: r.newStatus, error: r.error })) },
    }).catch(() => {});

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
    logger.error('Admin orders batch POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
