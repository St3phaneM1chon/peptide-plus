/**
 * Admin Single Order API
 * GET  - Full order detail
 * PUT  - Update order fields
 * POST - Actions (refund, reship)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import {
  createRefundAccountingEntries,
  createCreditNote,
  createInventoryLossEntry,
} from '@/lib/accounting/webhook-accounting.service';
import { generateCOGSEntry } from '@/lib/inventory';

// GET /api/admin/orders/[id] - Full order detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'EMPLOYEE' && session.user.role !== 'OWNER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

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

    // Fetch customer info
    const user = await prisma.user.findUnique({
      where: { id: order.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        loyaltyTier: true,
      },
    });

    // Fetch related accounting entries
    const journalEntries = await prisma.journalEntry.findMany({
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
    });

    // Fetch inventory transactions for this order
    const inventoryTransactions = await prisma.inventoryTransaction.findMany({
      where: { orderId: order.id },
      select: {
        id: true,
        type: true,
        quantity: true,
        unitCost: true,
        createdAt: true,
      },
    });

    // Fetch credit notes for this order
    const creditNotes = await prisma.creditNote.findMany({
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
    });

    return NextResponse.json({
      order,
      customer: user,
      journalEntries,
      inventoryTransactions,
      creditNotes: creditNotes.map((cn) => ({
        ...cn,
        total: Number(cn.total),
      })),
    });
  } catch (error) {
    console.error('Admin order detail GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/orders/[id] - Update order fields
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'EMPLOYEE' && session.user.role !== 'OWNER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, trackingNumber, carrier, adminNotes } = body;

    const existingOrder = await prisma.order.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Validate status if provided
    const validStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
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

    return NextResponse.json({ order });
  } catch (error) {
    console.error('Admin order PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/orders/[id]?action=refund|reship
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'EMPLOYEE' && session.user.role !== 'OWNER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
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
    console.error('Admin order POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ─── REFUND HANDLER ─────────────────────────────────────────────────────────────

async function handleRefund(
  request: NextRequest,
  orderId: string,
  session: { user: { id: string; role: string; name?: string | null; email?: string | null } }
) {
  const body = await request.json();
  const { amount, reason } = body;

  if (!amount || amount <= 0) {
    return NextResponse.json(
      { error: 'A positive refund amount is required' },
      { status: 400 }
    );
  }

  if (!reason) {
    return NextResponse.json(
      { error: 'A reason is required for refunds' },
      { status: 400 }
    );
  }

  // Find the order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Validate refund amount
  const orderTotal = Number(order.total);
  if (amount > orderTotal) {
    return NextResponse.json(
      { error: `Refund amount (${amount}) exceeds order total (${orderTotal})` },
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

  const isFullRefund = amount >= orderTotal;

  // Calculate proportional tax refund
  const refundRatio = amount / orderTotal;
  const refundTps = Math.round(Number(order.taxTps) * refundRatio * 100) / 100;
  const refundTvq = Math.round(Number(order.taxTvq) * refundRatio * 100) / 100;
  const refundTvh = Math.round(Number(order.taxTvh) * refundRatio * 100) / 100;
  const refundPst = Math.round(Number((order as any).taxPst || 0) * refundRatio * 100) / 100;

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

  // Update order status
  await prisma.order.update({
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
    for (const item of order.items) {
      if (item.formatId) {
        await prisma.productFormat.update({
          where: { id: item.formatId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      }

      // Get current WAC
      const lastTransaction = await prisma.inventoryTransaction.findFirst({
        where: {
          productId: item.productId,
          formatId: item.formatId,
        },
        orderBy: { createdAt: 'desc' },
        select: { runningWAC: true },
      });
      const wac = lastTransaction ? Number(lastTransaction.runningWAC) : 0;

      // Create RETURN inventory transaction
      await prisma.inventoryTransaction.create({
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

  // Find linked invoice & create CreditNote
  let creditNoteId: string | null = null;
  const invoice = await prisma.customerInvoice.findFirst({
    where: { orderId: order.id },
    select: { id: true },
  });

  // Get customer info for credit note
  const customer = await prisma.user.findUnique({
    where: { id: order.userId },
    select: { name: true, email: true },
  });

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
  const { reason } = body;

  if (!reason) {
    return NextResponse.json(
      { error: 'A reason is required for re-shipment' },
      { status: 400 }
    );
  }

  // Find the original order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, currency: { select: { id: true } } },
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

  // Generate replacement order number
  const lastOrder = await prisma.order.findFirst({
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  });
  const lastNum = lastOrder ? parseInt(lastOrder.orderNumber.split('-').pop() || '0') : 0;
  const year = new Date().getFullYear();
  const replacementOrderNumber = `PP-${year}-${String(lastNum + 1).padStart(6, '0')}`;

  // Create replacement order at $0
  const replacementOrder = await prisma.order.create({
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

  // Process inventory: LOSS on original + SALE on replacement + decrement stock
  let totalLossAmount = 0;

  for (const item of order.items) {
    // Get current WAC
    const lastTransaction = await prisma.inventoryTransaction.findFirst({
      where: {
        productId: item.productId,
        formatId: item.formatId,
      },
      orderBy: { createdAt: 'desc' },
      select: { runningWAC: true },
    });
    const wac = lastTransaction ? Number(lastTransaction.runningWAC) : 0;
    totalLossAmount += wac * item.quantity;

    // LOSS transaction on the original order (colis perdu)
    await prisma.inventoryTransaction.create({
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
    await prisma.inventoryTransaction.create({
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

    // Decrement stock
    if (item.formatId) {
      await prisma.productFormat.update({
        where: { id: item.formatId },
        data: { stockQuantity: { decrement: item.quantity } },
      });
    }
  }

  // Create inventory loss accounting entry
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
    console.error(`Failed to create COGS entry for reship ${replacementOrderNumber}:`, cogsError);
  }

  // Update original order admin notes
  await prisma.order.update({
    where: { id: orderId },
    data: {
      adminNotes: order.adminNotes
        ? `${order.adminNotes}\n[RESHIP] ${new Date().toISOString()} - Re-expedition ${replacementOrderNumber} - ${reason}`
        : `[RESHIP] ${new Date().toISOString()} - Re-expedition ${replacementOrderNumber} - ${reason}`,
    },
  });

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
