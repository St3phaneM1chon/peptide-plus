export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

const createReturnSchema = z.object({
  orderId: z.string().min(1, 'orderId is required'),
  orderItemId: z.string().min(1, 'orderItemId is required'),
  reason: z.string().min(1, 'reason is required').max(500),
  details: z.string().max(2000).optional(),
});

const updateReturnSchema = z.object({
  returnRequestId: z.string().min(1, 'returnRequestId is required'),
  status: z.enum(['PENDING', 'APPROVED', 'RECEIVED', 'REFUNDED', 'REJECTED']),
  resolution: z.string().max(500).optional(),
  adminNotes: z.string().max(2000).optional(),
});

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
    logger.error('Error fetching return requests', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new return request
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/account/returns');
    if (!rl.success) { const res = NextResponse.json({ error: rl.error!.message }, { status: 429 }); Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v)); return res; }

    // SECURITY (BE-SEC-15): CSRF protection for mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

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
    const parsed = createReturnSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { orderId, orderItemId, reason, details } = parsed.data;

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
        id: crypto.randomUUID(),
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

    const item = returnRequest.order.items.find((i: { id: string }) => i.id === orderItemId);

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
    logger.error('Error creating return request', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update return request status (admin use)
// BE-PAY-13: When a return is marked as RECEIVED, automatically trigger refund creation
export async function PATCH(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/account/returns');
    if (!rl.success) { const res = NextResponse.json({ error: rl.error!.message }, { status: 429 }); Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v)); return res; }

    // CSRF protection
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    });

    if (!user || (user.role !== 'EMPLOYEE' && user.role !== 'OWNER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateReturnSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { returnRequestId, status, resolution, adminNotes } = parsed.data;

    // Get the return request with order and item details
    const returnRequest = await prisma.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: {
        order: {
          include: { items: true },
        },
      },
    });

    if (!returnRequest) {
      return NextResponse.json({ error: 'Return request not found' }, { status: 404 });
    }

    // Update the return request status
    const updatedReturn = await prisma.returnRequest.update({
      where: { id: returnRequestId },
      data: {
        status,
        resolution: resolution || returnRequest.resolution,
        adminNotes: adminNotes || returnRequest.adminNotes,
      },
    });

    // BE-PAY-13: When return is marked as RECEIVED, trigger refund creation
    if (status === 'RECEIVED' || status === 'APPROVED') {
      const returnItem = returnRequest.order.items.find(
        (item) => item.id === returnRequest.orderItemId
      );

      if (returnItem) {
        const refundAmount = Number(returnItem.unitPrice) * returnItem.quantity;

        // BUG 13: Check if a refund already exists for this return before creating a new one
        const existingRefund = await prisma.refund.findFirst({
          where: {
            returnRequestId: returnRequest.id,
            status: { notIn: ['REJECTED', 'CANCELLED'] },
          },
        });

        if (existingRefund) {
          return NextResponse.json({
            returnRequest: updatedReturn,
            refund: {
              id: existingRefund.id,
              amount: Number(existingRefund.amount),
              status: existingRefund.status,
              reason: existingRefund.reason,
            },
            message: `Return marked as ${status}. Existing refund found (no duplicate created).`,
          });
        }

        // Create a refund record with PENDING status
        const refund = await prisma.refund.create({
          data: {
            orderId: returnRequest.orderId,
            returnRequestId: returnRequest.id,
            amount: refundAmount,
            status: 'PENDING',
            reason: 'RETURN',
            notes: `Auto-created from return request ${returnRequest.id}. Item: ${returnItem.productName || 'Unknown'} x${returnItem.quantity}`,
          },
        });

        return NextResponse.json({
          returnRequest: updatedReturn,
          refund: {
            id: refund.id,
            amount: Number(refund.amount),
            status: refund.status,
            reason: refund.reason,
          },
          message: `Return marked as ${status}. Refund of $${refundAmount.toFixed(2)} created with PENDING status.`,
        });
      }
    }

    return NextResponse.json({ returnRequest: updatedReturn });
  } catch (error) {
    logger.error('Error updating return request', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
