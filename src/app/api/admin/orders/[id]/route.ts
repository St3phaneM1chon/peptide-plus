export const dynamic = 'force-dynamic';

/**
 * Admin Single Order API
 * GET   - Full order detail
 * PATCH - Update order fields (used by frontend)
 * PUT   - Update order fields (legacy)
 * POST  - Actions (refund, reship)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import Stripe from 'stripe';
import { STRIPE_API_VERSION } from '@/lib/stripe';
import {
  createRefundAccountingEntries,
  createCreditNote,
  createInventoryLossEntry,
} from '@/lib/accounting/webhook-accounting.service';
import { generateCOGSEntry } from '@/lib/inventory';
import { sendOrderLifecycleEmail } from '@/lib/email';
import { getPayPalAccessToken, PAYPAL_API_URL } from '@/lib/paypal';
import { updateOrderStatusSchema, createRefundSchema } from '@/lib/validations/order';
import { clawbackAmbassadorCommission } from '@/lib/ambassador-commission';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const reshipSchema = z.object({
  reason: z.string().min(1, 'A reason is required for re-shipment').max(500),
}).strict();

// KB-PP-BUILD-002: Lazy init to avoid crash when STRIPE_SECRET_KEY is absent at build time
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
  }
  return _stripe;
}

// GET /api/admin/orders/[id] - Full order detail
export const GET = withAdminGuard(async (_request, { params }) => {
  try {
    const id = params!.id;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        currency: {
          select: { code: true, symbol: true, name: true },
        },
        replacementOrders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            replacementReason: true,
            createdAt: true,
          },
        },
        parentOrder: {
          select: {
            id: true,
            orderNumber: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // N+1 FIX: Fetch all related data in parallel instead of sequentially
    const [user, journalEntries, inventoryTransactions, creditNotes, paymentErrors] = await Promise.all([
      // Fetch customer info
      prisma.user.findUnique({
        where: { id: order.userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          loyaltyTier: true,
        },
      }),
      // Fetch related accounting entries
      prisma.journalEntry.findMany({
        where: { orderId: order.id },
        select: {
          id: true,
          entryNumber: true,
          type: true,
          description: true,
          status: true,
          date: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Fetch inventory transactions for this order
      prisma.inventoryTransaction.findMany({
        where: { orderId: order.id },
        select: {
          id: true,
          type: true,
          quantity: true,
          unitCost: true,
          createdAt: true,
        },
      }),
      // Fetch credit notes for this order
      prisma.creditNote.findMany({
        where: { orderId: order.id },
        select: {
          id: true,
          creditNoteNumber: true,
          total: true,
          reason: true,
          status: true,
          issuedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Fetch payment errors for this order
      prisma.paymentError.findMany({
        where: { orderId: order.id },
        select: {
          id: true,
          stripePaymentId: true,
          errorType: true,
          errorMessage: true,
          amount: true,
          currency: true,
          customerEmail: true,
          metadata: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Serialize Decimal fields to numbers
    const serializedOrder = {
      ...order,
      subtotal: Number(order.subtotal),
      shippingCost: Number(order.shippingCost),
      discount: Number(order.discount),
      tax: Number(order.tax),
      taxTps: Number(order.taxTps),
      taxTvq: Number(order.taxTvq),
      taxTvh: Number(order.taxTvh),
      total: Number(order.total),
      promoDiscount: order.promoDiscount ? Number(order.promoDiscount) : null,
      exchangeRate: Number(order.exchangeRate),
      taxPst: Number((order as Record<string, unknown>).taxPst || 0),
      items: order.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        total: Number(item.total),
      })),
    };

    return NextResponse.json({
      order: serializedOrder,
      customer: user,
      journalEntries,
      inventoryTransactions: inventoryTransactions.map((it) => ({
        ...it,
        unitCost: Number(it.unitCost),
      })),
      creditNotes: creditNotes.map((cn) => ({
        ...cn,
        total: Number(cn.total),
      })),
      paymentErrors: paymentErrors.map((pe) => ({
        ...pe,
        metadata: pe.metadata ? JSON.parse(pe.metadata) : null,
      })),
    });
  } catch (error) {
    logger.error('Admin order detail GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// ─── Shared update handler used by both PATCH and PUT ──────────────────────
async function handleOrderUpdate(
  request: NextRequest,
  id: string,
  session: { user: { id: string; role: string; name?: string | null; email?: string | null } }
) {
  const body = await request.json();

  // Validate with Zod
  const parsed = updateOrderStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { status, trackingNumber, carrier, adminNotes } = parsed.data;

  const existingOrder = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      trackingNumber: true,
      carrier: true,
      shippedAt: true,
      deliveredAt: true,
      updatedAt: true,
    },
  });

  if (!existingOrder) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // G1-FLAW-06: Optimistic locking - reject if order was modified since client loaded it
  if (body.updatedAt) {
    const clientUpdatedAt = new Date(body.updatedAt).getTime();
    const serverUpdatedAt = existingOrder.updatedAt.getTime();
    if (clientUpdatedAt !== serverUpdatedAt) {
      return NextResponse.json(
        { error: 'Order was modified by another user. Please refresh and try again.', code: 'CONFLICT' },
        { status: 409 }
      );
    }
  }

  // BE-PAY-09 + PAY-005: Order state machine - validate transitions
  // Note: CONFIRMED is set by payment webhooks (Stripe/PayPal), not by admin manual action.
  // Admin uses this map to advance orders through fulfillment (CONFIRMED -> PROCESSING -> SHIPPED -> etc.)
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

  const updateData: Record<string, unknown> = {};

  if (status !== undefined) {
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
    where: { id },
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
    targetId: id,
    previousValue: { status: existingOrder.status, trackingNumber: existingOrder.trackingNumber, carrier: existingOrder.carrier },
    newValue: { status: status || existingOrder.status, trackingNumber: trackingNumber || null, carrier: carrier || null, adminNotes: adminNotes || null },
    ipAddress: getClientIpFromRequest(request),
    userAgent: request.headers.get('user-agent') || undefined,
  }).catch((err: unknown) => { logger.error('[AdminOrder] Non-blocking audit log for order update failed', { error: err instanceof Error ? err.message : String(err) }); });

  // Send lifecycle email on status change (fire-and-forget)
  if (status && status !== existingOrder.status) {
    const emailEvent = status as string;
    const validEmailEvents = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

    if (validEmailEvents.includes(emailEvent)) {
      sendOrderLifecycleEmail(
        id,
        emailEvent as 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED',
        {
          trackingNumber: trackingNumber || undefined,
          carrier: carrier || undefined,
        },
      ).catch((err) => {
        logger.error(`Failed to send ${emailEvent} email for order ${id}`, { error: err instanceof Error ? err.message : String(err) });
      });
    }
  }

  // Serialize Decimal fields to numbers for JSON response
  const serializedOrder = {
    ...order,
    subtotal: Number(order.subtotal),
    shippingCost: Number(order.shippingCost),
    discount: Number(order.discount),
    tax: Number(order.tax),
    total: Number(order.total),
    taxTps: Number((order as Record<string, unknown>).taxTps || 0),
    taxTvq: Number((order as Record<string, unknown>).taxTvq || 0),
    taxTvh: Number((order as Record<string, unknown>).taxTvh || 0),
    items: order.items.map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      discount: Number(item.discount),
      total: Number(item.total),
    })),
  };

  return NextResponse.json({ order: serializedOrder });
}

// PATCH /api/admin/orders/[id] - Update order fields (used by frontend)
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    return await handleOrderUpdate(request, params!.id, session);
  } catch (error) {
    logger.error('Admin order PATCH error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// PUT /api/admin/orders/[id] - Update order fields (legacy)
export const PUT = withAdminGuard(async (request, { session, params }) => {
  try {
    return await handleOrderUpdate(request, params!.id, session);
  } catch (error) {
    logger.error('Admin order PUT error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// POST /api/admin/orders/[id]?action=refund|reship
export const POST = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'refund') {
      return handleRefund(request, id, session);
    }

    if (action === 'reship') {
      return handleReship(request, id, session);
    }

    return NextResponse.json(
      { error: 'Invalid action. Supported actions: refund, reship' },
      { status: 400 }
    );
  } catch (error) {
    logger.error('Admin order POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// ─── REFUND HANDLER ─────────────────────────────────────────────────────────────

async function handleRefund(
  request: NextRequest,
  orderId: string,
  session: { user: { id: string; role: string; name?: string | null; email?: string | null } }
) {
  const body = await request.json();

  // Validate with Zod
  const parsed = createRefundSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { amount, reason } = parsed.data;

  // Find the order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      userId: true,
      status: true,
      paymentStatus: true,
      total: true,
      taxTps: true,
      taxTvq: true,
      taxTvh: true,
      taxPst: true,
      stripePaymentId: true,
      paypalOrderId: true,
      adminNotes: true,
      shippingName: true,
      items: {
        select: {
          id: true,
          productId: true,
          formatId: true,
          quantity: true,
        },
      },
      currency: { select: { code: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Validate refund amount
  const orderTotal = Number(order.total);

  // BE-PAY-08: Calculate total already refunded to prevent over-refund
  const previousRefunds = await prisma.creditNote.aggregate({
    where: { orderId: orderId, status: { not: 'VOID' } },
    _sum: { total: true },
  });
  const alreadyRefunded = Number(previousRefunds._sum?.total || 0);
  const maxRefundable = Math.round((orderTotal - alreadyRefunded) * 100) / 100;

  if (amount > maxRefundable) {
    return NextResponse.json(
      {
        error: `Refund amount ($${amount}) exceeds maximum refundable amount ($${maxRefundable}). ` +
          `Order total: $${orderTotal}, already refunded: $${alreadyRefunded}.`,
      },
      { status: 400 }
    );
  }

  if (maxRefundable <= 0) {
    return NextResponse.json(
      { error: `Order has already been fully refunded ($${alreadyRefunded} of $${orderTotal})` },
      { status: 400 }
    );
  }

  // Check that order was paid
  if (order.paymentStatus !== 'PAID' && order.paymentStatus !== 'PARTIAL_REFUND') {
    return NextResponse.json(
      { error: `Cannot refund an order with payment status: ${order.paymentStatus}` },
      { status: 400 }
    );
  }

  // BE-PAY-08: Full refund = this refund covers the remaining refundable amount
  const isFullRefund = amount >= maxRefundable;

  // ── Actually refund via Stripe or PayPal ──────────────────────────────
  if (order.stripePaymentId) {
    // Stripe refund
    try {
      await getStripe().refunds.create({
        payment_intent: order.stripePaymentId,
        amount: Math.round(amount * 100), // Stripe uses cents
        reason: 'requested_by_customer',
      });
    } catch (stripeError) {
      logger.error('Stripe refund failed', { error: stripeError instanceof Error ? stripeError.message : String(stripeError) });
      return NextResponse.json(
        { error: `Stripe refund failed: ${stripeError instanceof Error ? stripeError.message : 'Unknown error'}` },
        { status: 502 }
      );
    }
  } else if (order.paypalOrderId) {
    // PayPal refund
    try {
      const paypalAccessToken = await getPayPalAccessToken();

      // Get the capture ID from the PayPal order
      const orderRes = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders/${order.paypalOrderId}`, {
        headers: { 'Authorization': `Bearer ${paypalAccessToken}` },
      });
      const orderData = await orderRes.json();
      const captureId = orderData.purchase_units?.[0]?.payments?.captures?.[0]?.id;

      if (!captureId) {
        return NextResponse.json(
          { error: 'PayPal capture ID not found - cannot refund' },
          { status: 400 }
        );
      }

      const refundRes = await fetch(`${PAYPAL_API_URL}/v2/payments/captures/${captureId}/refund`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${paypalAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          isFullRefund ? {} : { amount: { value: amount.toFixed(2), currency_code: order.currency?.code || 'CAD' } }
        ),
      });

      if (!refundRes.ok) {
        const refundError = await refundRes.json();
        logger.error('PayPal refund failed', { error: refundError instanceof Error ? refundError.message : String(refundError) });
        return NextResponse.json(
          { error: `PayPal refund failed: ${refundError.message || JSON.stringify(refundError)}` },
          { status: 502 }
        );
      }
    } catch (paypalError) {
      logger.error('PayPal refund failed', { error: paypalError instanceof Error ? paypalError.message : String(paypalError) });
      return NextResponse.json(
        { error: `PayPal refund failed: ${paypalError instanceof Error ? paypalError.message : 'Unknown error'}` },
        { status: 502 }
      );
    }
  } else {
    return NextResponse.json(
      { error: 'No payment provider ID found on order - cannot refund' },
      { status: 400 }
    );
  }

  // Calculate proportional tax refund
  const refundRatio = amount / orderTotal;
  const refundTps = Math.round(Number(order.taxTps) * refundRatio * 100) / 100;
  const refundTvq = Math.round(Number(order.taxTvq) * refundRatio * 100) / 100;
  const refundTvh = Math.round(Number(order.taxTvh) * refundRatio * 100) / 100;
  const refundPst = Math.round(Number((order as Record<string, unknown>).taxPst || 0) * refundRatio * 100) / 100;

  // Create refund accounting entries
  const entryId = await createRefundAccountingEntries(
    order.id,
    amount,
    refundTps,
    refundTvq,
    refundTvh,
    reason,
    refundPst
  );

  // Update order status + restore stock atomically in a single transaction
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: isFullRefund ? 'REFUNDED' : 'PARTIAL_REFUND',
        status: isFullRefund ? 'CANCELLED' : order.status,
        adminNotes: order.adminNotes
          ? `${order.adminNotes}\n[REFUND] ${new Date().toISOString()} - $${amount} - ${reason}`
          : `[REFUND] ${new Date().toISOString()} - $${amount} - ${reason}`,
      },
    });

    // Restore stock for full refunds
    if (isFullRefund) {
      // N+1 FIX: Batch-fetch WAC for all items upfront
      const wacResults = await tx.inventoryTransaction.findMany({
        where: {
          OR: order.items.map(item => ({
            productId: item.productId,
            formatId: item.formatId,
          })),
        },
        orderBy: { createdAt: 'desc' },
        distinct: ['productId', 'formatId'],
        select: { productId: true, formatId: true, runningWAC: true },
      });
      const wacMap = new Map(wacResults.map(w => [`${w.productId}-${w.formatId}`, Number(w.runningWAC)]));

      for (const item of order.items) {
        if (item.formatId) {
          await tx.productFormat.update({
            where: { id: item.formatId },
            data: { stockQuantity: { increment: item.quantity } },
          });
        }

        const wac = wacMap.get(`${item.productId}-${item.formatId}`) ?? 0;

        // Create RETURN inventory transaction
        await tx.inventoryTransaction.create({
          data: {
            productId: item.productId,
            formatId: item.formatId,
            type: 'RETURN',
            quantity: item.quantity,
            unitCost: wac,
            runningWAC: wac,
            orderId: order.id,
            reason: `Admin refund: ${reason}`,
            createdBy: session.user.id,
          },
        });
      }
    }
  });

  // N+1 FIX: Fetch invoice and customer in parallel
  let creditNoteId: string | null = null;
  const [invoice, customer] = await Promise.all([
    prisma.customerInvoice.findFirst({
      where: { orderId: order.id },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { id: order.userId },
      select: { name: true, email: true },
    }),
  ]);

  const netRefund = amount - refundTps - refundTvq - refundTvh - refundPst;
  creditNoteId = await createCreditNote({
    orderId: order.id,
    invoiceId: invoice?.id,
    customerName: customer?.name || order.shippingName,
    customerEmail: customer?.email,
    subtotal: netRefund,
    taxTps: refundTps,
    taxTvq: refundTvq,
    taxTvh: refundTvh,
    taxPst: refundPst,
    total: amount,
    reason,
    journalEntryId: entryId,
    issuedBy: session.user.id,
  });

  // Clawback ambassador commission on refund (P2 #28 fix)
  let commissionClawback: { clawbackAmount?: number; wasPaidOut?: boolean } = {};
  try {
    const clawbackResult = await clawbackAmbassadorCommission(
      orderId,
      amount,
      orderTotal,
      isFullRefund
    );
    if (clawbackResult.clawbackAmount && clawbackResult.clawbackAmount > 0) {
      commissionClawback = {
        clawbackAmount: clawbackResult.clawbackAmount,
        wasPaidOut: clawbackResult.wasPaidOut,
      };
    }
  } catch (commError) {
    logger.error('Failed to clawback ambassador commission', { error: commError instanceof Error ? commError.message : String(commError) });
  }

  // Audit log for refund (fire-and-forget)
  logAdminAction({
    adminUserId: session.user.id,
    action: 'REFUND_ORDER',
    targetType: 'Order',
    targetId: orderId,
    previousValue: { paymentStatus: order.paymentStatus, status: order.status },
    newValue: { paymentStatus: isFullRefund ? 'REFUNDED' : 'PARTIAL_REFUND', amount, reason, isFullRefund },
    ipAddress: getClientIpFromRequest(request),
    userAgent: request.headers.get('user-agent') || undefined,
    metadata: { journalEntryId: entryId, creditNoteId, commissionClawback: commissionClawback.clawbackAmount ? commissionClawback : null },
  }).catch((err: unknown) => { logger.error('[AdminOrder] Non-blocking audit log for refund failed', { error: err instanceof Error ? err.message : String(err) }); });

  // ── Send refund email (fire-and-forget) ──────────────────────────────
  sendOrderLifecycleEmail(orderId, 'REFUNDED', {
    refundAmount: amount,
    refundIsPartial: !isFullRefund,
  }).catch((err) => {
    logger.error(`Failed to send REFUNDED email for order ${orderId}`, { error: err instanceof Error ? err.message : String(err) });
  });

  // If full refund also triggers a cancellation, send the cancelled email too
  if (isFullRefund) {
    sendOrderLifecycleEmail(orderId, 'CANCELLED', {
      cancellationReason: reason,
    }).catch((err) => {
      logger.error(`Failed to send CANCELLED email for order ${orderId}`, { error: err instanceof Error ? err.message : String(err) });
    });
  }

  return NextResponse.json({
    success: true,
    refund: {
      amount,
      isFullRefund,
      journalEntryId: entryId,
      creditNoteId,
      taxRefunded: {
        tps: refundTps,
        tvq: refundTvq,
        tvh: refundTvh,
      },
      commissionClawback: commissionClawback.clawbackAmount
        ? commissionClawback
        : null,
    },
  });
}

// ─── RESHIP HANDLER ─────────────────────────────────────────────────────────────

async function handleReship(
  request: NextRequest,
  orderId: string,
  session: { user: { id: string; role: string; name?: string | null; email?: string | null } }
) {
  const body = await request.json();

  // Validate with Zod
  const parsed = reshipSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { reason } = parsed.data;

  // Find the original order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      userId: true,
      status: true,
      currencyId: true,
      shippingName: true,
      shippingAddress1: true,
      shippingAddress2: true,
      shippingCity: true,
      shippingState: true,
      shippingPostal: true,
      shippingCountry: true,
      shippingPhone: true,
      adminNotes: true,
      items: {
        select: {
          id: true,
          productId: true,
          formatId: true,
          productName: true,
          formatName: true,
          sku: true,
          quantity: true,
        },
      },
      currency: { select: { id: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Only allow reship for SHIPPED or DELIVERED orders
  if (order.status !== 'SHIPPED' && order.status !== 'DELIVERED') {
    return NextResponse.json(
      { error: `Cannot reship an order with status: ${order.status}. Must be SHIPPED or DELIVERED.` },
      { status: 400 }
    );
  }

  // BUG 11: Generate replacement order number with FOR UPDATE lock to prevent duplicates
  const year = new Date().getFullYear();
  const prefix = `PP-${year}-`;

  // Create replacement order at $0 (inside transaction for atomic order number)
  const replacementOrder = await prisma.$transaction(async (tx) => {
    const lastRows = await tx.$queryRaw<{ order_number: string }[]>`
      SELECT "orderNumber" as order_number FROM "Order"
      WHERE "orderNumber" LIKE ${prefix + '%'}
      ORDER BY "orderNumber" DESC
      LIMIT 1
      FOR UPDATE
    `;
    const lastNum = lastRows.length > 0
      ? parseInt(lastRows[0].order_number.replace(prefix, ''), 10)
      : 0;
    const replacementOrderNumber = `${prefix}${String(lastNum + 1).padStart(6, '0')}`;

    return tx.order.create({
      data: {
        orderNumber: replacementOrderNumber,
        userId: order.userId,
        subtotal: 0,
        shippingCost: 0,
        discount: 0,
        tax: 0,
        taxTps: 0,
        taxTvq: 0,
        taxTvh: 0,
        total: 0,
        currencyId: order.currencyId,
        paymentStatus: 'PAID', // $0 = considered paid
        status: 'PROCESSING',
        shippingName: order.shippingName,
        shippingAddress1: order.shippingAddress1,
        shippingAddress2: order.shippingAddress2,
        shippingCity: order.shippingCity,
        shippingState: order.shippingState,
        shippingPostal: order.shippingPostal,
        shippingCountry: order.shippingCountry,
        shippingPhone: order.shippingPhone,
        parentOrderId: order.id,
        replacementReason: reason,
        orderType: 'REPLACEMENT',
        adminNotes: `[RESHIP] Re-expedition de ${order.orderNumber} - ${reason}`,
        items: {
          create: order.items.map((item) => ({
            productId: item.productId,
            formatId: item.formatId,
            productName: item.productName,
            formatName: item.formatName,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: 0,
            discount: 0,
            total: 0,
          })),
        },
      },
      include: { items: true },
    });
  });

  const replacementOrderNumber = replacementOrder.orderNumber;

  // BUG 10: Wrap all inventory mutations in a single transaction for atomicity.
  // If any LOSS/SALE/stock-decrement fails, the entire batch rolls back.
  const totalLossAmount = await prisma.$transaction(async (tx) => {
    let lossAccumulator = 0;

    // N+1 FIX: Batch-fetch WAC for all items upfront
    const wacResults = await tx.inventoryTransaction.findMany({
      where: {
        OR: order.items.map(item => ({
          productId: item.productId,
          formatId: item.formatId,
        })),
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['productId', 'formatId'],
      select: { productId: true, formatId: true, runningWAC: true },
    });
    const wacMap = new Map(wacResults.map(w => [`${w.productId}-${w.formatId}`, Number(w.runningWAC)]));

    for (const item of order.items) {
      const wac = wacMap.get(`${item.productId}-${item.formatId}`) ?? 0;
      lossAccumulator += wac * item.quantity;

      // LOSS transaction on the original order (colis perdu)
      await tx.inventoryTransaction.create({
        data: {
          productId: item.productId,
          formatId: item.formatId,
          type: 'LOSS',
          quantity: -item.quantity,
          unitCost: wac,
          runningWAC: wac,
          orderId: order.id,
          reason: `Colis perdu: ${reason}`,
          createdBy: session.user.id,
        },
      });

      // SALE transaction on the replacement order (new shipment from stock)
      await tx.inventoryTransaction.create({
        data: {
          productId: item.productId,
          formatId: item.formatId,
          type: 'SALE',
          quantity: -item.quantity,
          unitCost: wac,
          runningWAC: wac,
          orderId: replacementOrder.id,
          reason: `Re-expedition ${replacementOrderNumber}`,
          createdBy: session.user.id,
        },
      });

      // E-08 FIX: Atomic conditional stock decrement — prevents negative inventory
      if (item.formatId) {
        const rowsAffected: number = await tx.$executeRaw`
          UPDATE "ProductFormat"
          SET "stockQuantity" = "stockQuantity" - ${item.quantity},
              "updatedAt" = NOW()
          WHERE id = ${item.formatId}
            AND "stockQuantity" >= ${item.quantity}
        `;
        if (rowsAffected === 0) {
          logger.warn(`[Admin reship] Insufficient stock for format ${item.formatId}: wanted to decrement ${item.quantity}, atomic UPDATE matched 0 rows`);
        }
      }
    }

    // Update original order admin notes (inside transaction for consistency)
    await tx.order.update({
      where: { id: orderId },
      data: {
        adminNotes: order.adminNotes
          ? `${order.adminNotes}\n[RESHIP] ${new Date().toISOString()} - Re-expedition ${replacementOrderNumber} - ${reason}`
          : `[RESHIP] ${new Date().toISOString()} - Re-expedition ${replacementOrderNumber} - ${reason}`,
      },
    });

    return lossAccumulator;
  });

  // Create inventory loss accounting entry (outside transaction - non-critical)
  let lossEntryId: string | null = null;
  if (totalLossAmount > 0) {
    lossEntryId = await createInventoryLossEntry(
      order.id,
      order.orderNumber,
      totalLossAmount,
      reason
    );
  }

  // Generate COGS entry for the replacement order (non-blocking)
  try {
    await generateCOGSEntry(replacementOrder.id);
  } catch (cogsError) {
    logger.error(`Failed to create COGS entry for reship ${replacementOrderNumber}`, { error: cogsError instanceof Error ? cogsError.message : String(cogsError) });
  }

  // Audit log for reship (fire-and-forget)
  logAdminAction({
    adminUserId: session.user.id,
    action: 'RESHIP_ORDER',
    targetType: 'Order',
    targetId: orderId,
    newValue: { reason, replacementOrderId: replacementOrder.id, replacementOrderNumber, itemsReshipped: order.items.length },
    ipAddress: getClientIpFromRequest(request),
    userAgent: request.headers.get('user-agent') || undefined,
    metadata: { originalOrderNumber: order.orderNumber, totalLossAmount: Math.round(totalLossAmount * 100) / 100, lossEntryId },
  }).catch((err: unknown) => { logger.error('[AdminOrder] Non-blocking audit log for reship failed', { error: err instanceof Error ? err.message : String(err) }); });

  return NextResponse.json({
    success: true,
    reship: {
      replacementOrderId: replacementOrder.id,
      replacementOrderNumber,
      reason,
      lossEntryId,
      itemsReshipped: order.items.length,
      totalLossAmount: Math.round(totalLossAmount * 100) / 100,
    },
  });
}
