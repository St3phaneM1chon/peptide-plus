export const dynamic = 'force-dynamic';

/**
 * API Update Order Shipping Address
 * PUT /api/account/orders/[id]/update-address
 *
 * Allows customers to update shipping address for orders that haven't been shipped yet
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';

const updateAddressSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  address1: z.string().min(1, 'Address is required').max(200),
  address2: z.string().max(200).optional(),
  city: z.string().min(1, 'City is required').max(100),
  province: z.string().min(1, 'Province is required').max(100),
  postalCode: z.string().min(1, 'Postal code is required').max(20),
  country: z.string().min(1, 'Country is required').max(100),
  phone: z.string().max(30).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/account/orders/update-address');
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

    const { id: orderId } = await params;
    const body = await request.json();
    const parsed = updateAddressSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { firstName, lastName, address1, city, province, postalCode, country } = parsed.data;

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch the order, ensuring it belongs to the authenticated user
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: user.id,
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        shippingName: true,
        shippingAddress1: true,
        shippingAddress2: true,
        shippingCity: true,
        shippingState: true,
        shippingPostal: true,
        shippingCountry: true,
        shippingPhone: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Only allow updates for PENDING or CONFIRMED orders
    if (order.status !== 'PENDING' && order.status !== 'CONFIRMED') {
      return NextResponse.json(
        { error: 'Cannot update address for orders that are being processed or have been shipped' },
        { status: 400 }
      );
    }

    // Store old address for audit log
    const oldAddress = {
      name: order.shippingName,
      address1: order.shippingAddress1,
      address2: order.shippingAddress2,
      city: order.shippingCity,
      province: order.shippingState,
      postalCode: order.shippingPostal,
      country: order.shippingCountry,
      phone: order.shippingPhone,
    };

    const newAddress = {
      name: `${firstName} ${lastName}`,
      address1,
      address2: parsed.data.address2 || '',
      city,
      province,
      postalCode,
      country,
      phone: parsed.data.phone || '',
    };

    // Update the order's shipping address
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        shippingName: `${firstName} ${lastName}`,
        shippingAddress1: address1,
        shippingAddress2: parsed.data.address2 || null,
        shippingCity: city,
        shippingState: province,
        shippingPostal: postalCode,
        shippingCountry: country,
        shippingPhone: parsed.data.phone || null,
      },
      include: {
        items: true,
        currency: true,
      },
    });

    // Log the change in audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'Order',
        entityId: orderId,
        details: JSON.stringify({
          orderNumber: order.orderNumber,
          changes: [
            {
              field: 'shippingAddress',
              fieldLabel: 'Shipping Address',
              oldValue: oldAddress,
              newValue: newAddress,
              changeType: 'MODIFY',
            },
          ],
          metadata: {
            updatedBy: user.name || session.user.name,
            updatedAt: new Date().toISOString(),
          },
        }),
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });

    // Format response similar to orders page structure
    return NextResponse.json({
      success: true,
      order: {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        status: updatedOrder.status,
        paymentStatus: updatedOrder.paymentStatus,
        total: Number(updatedOrder.total),
        subtotal: Number(updatedOrder.subtotal),
        tax: Number(updatedOrder.tax),
        taxDetails: {
          gst: Number(updatedOrder.taxTps),
          qst: Number(updatedOrder.taxTvq),
          hst: Number(updatedOrder.taxTvh),
          pst: Number(updatedOrder.taxPst),
        },
        shippingCost: Number(updatedOrder.shippingCost),
        discount: Number(updatedOrder.discount),
        promoCode: updatedOrder.promoCode,
        trackingNumber: updatedOrder.trackingNumber,
        trackingUrl: updatedOrder.trackingUrl,
        carrier: updatedOrder.carrier,
        createdAt: updatedOrder.createdAt.toISOString(),
        shippedAt: updatedOrder.shippedAt?.toISOString(),
        deliveredAt: updatedOrder.deliveredAt?.toISOString(),
        paidAt: updatedOrder.paidAt?.toISOString(),
        paymentMethod: updatedOrder.paymentMethod,
        items: updatedOrder.items.map((item) => ({
          id: item.id,
          productName: item.productName,
          formatName: item.formatName,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          sku: item.sku,
        })),
        currency: {
          code: updatedOrder.currency.code,
        },
        shippingAddress: {
          firstName,
          lastName,
          address1,
          address2: parsed.data.address2,
          city,
          province,
          postalCode,
          country,
          phone: parsed.data.phone,
        },
        billingAddress: {
          firstName,
          lastName,
          address1,
          address2: parsed.data.address2,
          city,
          province,
          postalCode,
          country,
          phone: parsed.data.phone,
        },
      },
    });
  } catch (error) {
    logger.error('Update address error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
