/**
 * Public API v1 - Orders (single)
 * GET /api/v1/orders/:id - Get a single order by ID or order number
 */

import { NextRequest } from 'next/server';
import { withApiAuth, jsonSuccess, jsonError } from '@/lib/api/api-auth.middleware';
import { prisma } from '@/lib/db';

export const GET = withApiAuth(async (_request: NextRequest, { params }) => {
  const id = params?.id;
  if (!id) {
    return jsonError('Order ID is required', 400);
  }

  // Try finding by ID first, then by orderNumber
  const order = await prisma.order.findFirst({
    where: {
      OR: [{ id }, { orderNumber: id }],
    },
    select: {
      id: true,
      orderNumber: true,
      userId: true,
      subtotal: true,
      shippingCost: true,
      discount: true,
      tax: true,
      taxTps: true,
      taxTvq: true,
      taxTvh: true,
      taxPst: true,
      total: true,
      currencyId: true,
      exchangeRate: true,
      promoCode: true,
      promoDiscount: true,
      paymentMethod: true,
      paymentStatus: true,
      status: true,
      shippingName: true,
      shippingAddress1: true,
      shippingAddress2: true,
      shippingCity: true,
      shippingState: true,
      shippingPostal: true,
      shippingCountry: true,
      shippingPhone: true,
      carrier: true,
      trackingNumber: true,
      trackingUrl: true,
      shippedAt: true,
      deliveredAt: true,
      customerNotes: true,
      billingName: true,
      billingAddress1: true,
      billingCity: true,
      billingState: true,
      billingPostal: true,
      billingCountry: true,
      billingSameAsShipping: true,
      orderType: true,
      createdAt: true,
      updatedAt: true,
      items: {
        select: {
          id: true,
          productId: true,
          formatId: true,
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
        select: {
          code: true,
          symbol: true,
          name: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (!order) {
    return jsonError('Order not found', 404);
  }

  return jsonSuccess(order);
}, 'orders:read');
