export const dynamic = 'force-dynamic';

/**
 * API Update Order Shipping Address
 * PUT /api/account/orders/[id]/update-address
 *
 * Allows customers to update shipping address for orders that haven't been shipped yet
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';

interface UpdateAddressRequest {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: orderId } = await params;
    const body = await request.json() as UpdateAddressRequest;

    // Validate required fields
    const { firstName, lastName, address1, city, province, postalCode, country } = body;

    if (!firstName || !lastName || !address1 || !city || !province || !postalCode || !country) {
      return NextResponse.json(
        { error: 'Missing required address fields' },
        { status: 400 }
      );
    }

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
      address2: body.address2 || '',
      city,
      province,
      postalCode,
      country,
      phone: body.phone || '',
    };

    // Update the order's shipping address
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        shippingName: `${firstName} ${lastName}`,
        shippingAddress1: address1,
        shippingAddress2: body.address2 || null,
        shippingCity: city,
        shippingState: province,
        shippingPostal: postalCode,
        shippingCountry: country,
        shippingPhone: body.phone || null,
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
          address2: body.address2,
          city,
          province,
          postalCode,
          country,
          phone: body.phone,
        },
        billingAddress: {
          firstName,
          lastName,
          address1,
          address2: body.address2,
          city,
          province,
          postalCode,
          country,
          phone: body.phone,
        },
      },
    });
  } catch (error) {
    console.error('Update address error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
