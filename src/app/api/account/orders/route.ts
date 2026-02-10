import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user
    const user = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all orders for user
    const orders = await db.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
      },
    });

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

    return NextResponse.json(formattedOrders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json([]);
  }
}
