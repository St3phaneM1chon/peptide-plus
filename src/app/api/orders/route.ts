export const dynamic = 'force-dynamic';

/**
 * API Commandes utilisateur
 * GET /api/orders - Liste les commandes de l'utilisateur connecté (avec pagination)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pagination parameters
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          subtotal: true,
          shippingCost: true,
          discount: true,
          tax: true,
          total: true,
          shippingName: true,
          shippingAddress1: true,
          shippingAddress2: true,
          shippingCity: true,
          shippingState: true,
          shippingPostal: true,
          shippingCountry: true,
          shippingPhone: true,
          trackingNumber: true,
          trackingUrl: true,
          carrier: true,
          taxTps: true,
          taxPst: true,
          taxTvq: true,
          taxTvh: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              productId: true,
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
      db.order.count({ where: { userId: user.id } }),
    ]);

    // Format orders with properly structured addresses
    const formattedOrders = orders.map((order) => {
      // Parse name into first and last name
      const nameParts = (order.shippingName || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      return {
        ...order,
        shippingAddress: {
          firstName,
          lastName,
          address1: order.shippingAddress1,
          address2: order.shippingAddress2,
          city: order.shippingCity,
          province: order.shippingState,
          postalCode: order.shippingPostal,
          country: order.shippingCountry,
          phone: order.shippingPhone,
        },
        billingAddress: {
          firstName,
          lastName,
          address1: order.shippingAddress1,
          address2: order.shippingAddress2,
          city: order.shippingCity,
          province: order.shippingState,
          postalCode: order.shippingPostal,
          country: order.shippingCountry,
          phone: order.shippingPhone,
        },
        taxDetails: {
          gst: order.taxTps,
          pst: order.taxPst,
          qst: order.taxTvq,
          hst: order.taxTvh,
        },
      };
    });

    return NextResponse.json({
      orders: formattedOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
    });

  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
