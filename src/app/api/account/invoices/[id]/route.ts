export const dynamic = 'force-dynamic';
/**
 * API - Single invoice detail
 * GET /api/account/invoices/[id]
 * Returns full order data with items, addresses, taxes, payment info
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Fetch order with all related data
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        currency: {
          select: {
            code: true,
            symbol: true,
            name: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Verify order belongs to authenticated user
    if (order.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Verify the order has been paid
    if (order.paymentStatus !== 'PAID') {
      return NextResponse.json(
        { error: 'Invoice not available for unpaid orders' },
        { status: 400 }
      );
    }

    // Build full invoice response with Number() conversions
    const invoice = {
      id: order.id,
      orderNumber: order.orderNumber,
      invoiceNumber: `INV-${order.orderNumber}`,
      date: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),

      // Items
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        formatName: item.formatName,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        total: Number(item.total),
      })),

      // Amounts
      subtotal: Number(order.subtotal),
      shippingCost: Number(order.shippingCost),
      discount: Number(order.discount),
      taxTps: Number(order.taxTps),
      taxTvq: Number(order.taxTvq),
      taxTvh: Number(order.taxTvh),
      taxPst: Number(order.taxPst),
      total: Number(order.total),

      // Currency
      currency: order.currency ? {
        code: order.currency.code,
        symbol: order.currency.symbol,
        name: order.currency.name,
      } : { code: 'CAD', symbol: '$', name: 'Canadian Dollar' },
      exchangeRate: Number(order.exchangeRate),

      // Promo
      promoCode: order.promoCode,
      promoDiscount: order.promoDiscount ? Number(order.promoDiscount) : null,

      // Payment
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,

      // Order status
      status: order.status,

      // Shipping address
      shippingAddress: {
        name: order.shippingName,
        address1: order.shippingAddress1,
        address2: order.shippingAddress2,
        city: order.shippingCity,
        state: order.shippingState,
        postal: order.shippingPostal,
        country: order.shippingCountry,
        phone: order.shippingPhone,
      },

      // Shipping info
      carrier: order.carrier,
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
      shippedAt: order.shippedAt?.toISOString() || null,
      deliveredAt: order.deliveredAt?.toISOString() || null,

      // Notes
      customerNotes: order.customerNotes,
    };

    return NextResponse.json({ invoice });
  } catch (error) {
    logger.error('Error fetching invoice detail', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    );
  }
}
