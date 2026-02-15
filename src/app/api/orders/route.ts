export const dynamic = 'force-dynamic';

/**
 * API Commandes utilisateur
 * GET /api/orders - Liste les commandes de l'utilisateur connecté
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const orders = await db.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        currency: {
          select: { code: true, symbol: true },
        },
      },
    });

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

    return NextResponse.json({ orders: formattedOrders });

  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
