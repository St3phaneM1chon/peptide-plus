export const dynamic = 'force-dynamic';

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

    // Get user
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get paginated orders for user
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
          total: true,
          subtotal: true,
          tax: true,
          shippingCost: true,
          trackingNumber: true,
          shippingName: true,
          shippingAddress1: true,
          shippingCity: true,
          shippingState: true,
          shippingPostal: true,
          shippingCountry: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              productId: true,
              productName: true,
              formatName: true,
              quantity: true,
              unitPrice: true,
            },
          },
        },
      }),
      db.order.count({ where: { userId: user.id } }),
    ]);

    // Format orders for frontend
    const formattedOrders = orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber || `PP-${order.createdAt.getFullYear()}-${order.id.slice(0, 6).toUpperCase()}`,
      createdAt: order.createdAt.toISOString(),
      status: order.status,
      total: Number(order.total),
      subtotal: Number(order.subtotal),
      tax: Number(order.tax),
      shipping: Number(order.shippingCost),
      trackingNumber: order.trackingNumber,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.productName,
        format: item.formatName || '',
        quantity: item.quantity,
        price: Number(item.unitPrice),
        image: null, // Product image fetched separately if needed
      })),
      shippingAddress: {
        name: order.shippingName || '',
        address: order.shippingAddress1 || '',
        city: order.shippingCity || '',
        province: order.shippingState || '',
        postalCode: order.shippingPostal || '',
        country: order.shippingCountry || 'Canada',
      },
    }));

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
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
