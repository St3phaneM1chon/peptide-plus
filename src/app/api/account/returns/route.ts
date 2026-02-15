export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';

// GET - List user's return requests
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all return requests for user
    const returnRequests = await prisma.returnRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          include: {
            items: true,
          },
        },
      },
    });

    // Format return requests
    const formattedReturns = returnRequests.map((returnRequest) => {
      const orderItem = returnRequest.order.items.find(
        (item) => item.id === returnRequest.orderItemId
      );

      return {
        id: returnRequest.id,
        orderId: returnRequest.orderId,
        orderNumber: returnRequest.order.orderNumber,
        orderItemId: returnRequest.orderItemId,
        productName: orderItem?.productName || 'Unknown Product',
        formatName: orderItem?.formatName || '',
        quantity: orderItem?.quantity || 0,
        reason: returnRequest.reason,
        details: returnRequest.details,
        status: returnRequest.status,
        resolution: returnRequest.resolution,
        adminNotes: returnRequest.adminNotes,
        createdAt: returnRequest.createdAt.toISOString(),
        updatedAt: returnRequest.updatedAt.toISOString(),
      };
    });

    return NextResponse.json(formattedReturns);
  } catch (error) {
    console.error('Error fetching return requests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new return request
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { orderId, orderItemId, reason, details } = body;

    // Validate required fields
    if (!orderId || !orderItemId || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: orderId, orderItemId, reason' },
        { status: 400 }
      );
    }

    // Verify order belongs to user
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized - order does not belong to you' }, { status: 403 });
    }

    // Verify order item exists in order
    const orderItem = order.items.find((item) => item.id === orderItemId);
    if (!orderItem) {
      return NextResponse.json({ error: 'Order item not found in this order' }, { status: 404 });
    }

    // Check if order is delivered
    if (order.status !== 'DELIVERED') {
      return NextResponse.json(
        { error: 'Can only request returns for delivered orders' },
        { status: 400 }
      );
    }

    // Check if order is within 30 days
    const deliveredDate = order.deliveredAt || order.createdAt;
    const daysSinceDelivery = Math.floor(
      (Date.now() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceDelivery > 30) {
      return NextResponse.json(
        { error: 'Return window has expired. Returns must be requested within 30 days of delivery.' },
        { status: 400 }
      );
    }

    // Check if return request already exists for this item
    const existingReturn = await prisma.returnRequest.findFirst({
      where: {
        orderItemId,
        status: {
          notIn: ['REJECTED', 'REFUNDED'], // Allow new request if previous was rejected or completed
        },
      },
    });

    if (existingReturn) {
      return NextResponse.json(
        { error: 'A return request already exists for this item' },
        { status: 400 }
      );
    }

    // Create return request
    const returnRequest = await prisma.returnRequest.create({
      data: {
        orderId,
        orderItemId,
        userId: user.id,
        reason,
        details: details || null,
        status: 'PENDING',
      },
      include: {
        order: {
          include: {
            items: true,
          },
        },
      },
    });

    const item = returnRequest.order.items.find((i) => i.id === orderItemId);

    return NextResponse.json({
      id: returnRequest.id,
      orderId: returnRequest.orderId,
      orderNumber: returnRequest.order.orderNumber,
      orderItemId: returnRequest.orderItemId,
      productName: item?.productName || 'Unknown Product',
      formatName: item?.formatName || '',
      quantity: item?.quantity || 0,
      reason: returnRequest.reason,
      details: returnRequest.details,
      status: returnRequest.status,
      resolution: returnRequest.resolution,
      adminNotes: returnRequest.adminNotes,
      createdAt: returnRequest.createdAt.toISOString(),
      updatedAt: returnRequest.updatedAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating return request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
