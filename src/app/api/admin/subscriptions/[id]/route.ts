export const dynamic = 'force-dynamic';

/**
 * Admin Subscription Detail API
 * GET    - Single subscription detail
 * PATCH  - Update subscription (pause, resume, cancel, change frequency)
 * DELETE - Cancel subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';

// GET /api/admin/subscriptions/[id] - Get subscription detail
export const GET = withAdminGuard(async (_request, { session, params }) => {
  try {
    const id = params!.id;

    const subscription = await prisma.subscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: subscription.userId },
      select: { id: true, name: true, email: true, phone: true, image: true },
    });

    // Get product info if product still exists
    let product = null;
    try {
      product = await prisma.product.findUnique({
        where: { id: subscription.productId },
        select: { id: true, name: true, slug: true, imageUrl: true },
      });
    } catch {
      // Product may have been deleted
    }

    // Get format info if format still exists
    let format = null;
    if (subscription.formatId) {
      try {
        format = await prisma.productFormat.findUnique({
          where: { id: subscription.formatId },
          select: { id: true, name: true, formatType: true, price: true },
        });
      } catch {
        // Format may have been deleted
      }
    }

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        userId: subscription.userId,
        userName: user?.name || 'Unknown',
        userEmail: user?.email || '',
        userPhone: user?.phone || null,
        userImage: user?.image || null,
        productId: subscription.productId,
        productName: subscription.productName,
        productSlug: product?.slug || null,
        productImage: product?.imageUrl || null,
        formatId: subscription.formatId,
        formatName: subscription.formatName || '',
        formatDetails: format
          ? { name: format.name, formatType: format.formatType, price: Number(format.price) }
          : null,
        quantity: subscription.quantity,
        frequency: subscription.frequency,
        price: Number(subscription.unitPrice),
        discount: subscription.discountPercent,
        status: subscription.status,
        nextDelivery: subscription.nextDelivery.toISOString(),
        lastDelivery: subscription.lastDelivery?.toISOString() || null,
        cancelledAt: subscription.cancelledAt?.toISOString() || null,
        createdAt: subscription.createdAt.toISOString(),
        updatedAt: subscription.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Admin subscription GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// PATCH /api/admin/subscriptions/[id] - Update subscription
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();

    const existing = await prisma.subscription.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    // Status changes: pause, resume, cancel
    if (body.status !== undefined) {
      // BE-PAY-07: Added PENDING_PAYMENT as valid status
      const validStatuses = ['ACTIVE', 'PAUSED', 'CANCELLED', 'PENDING_PAYMENT'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }

      // Validate transitions
      if (body.status === 'ACTIVE' && existing.status === 'CANCELLED') {
        return NextResponse.json(
          { error: 'Cannot reactivate a cancelled subscription' },
          { status: 400 }
        );
      }

      updateData.status = body.status;

      if (body.status === 'CANCELLED') {
        updateData.cancelledAt = new Date();
      }
    }

    // Frequency change
    if (body.frequency !== undefined) {
      const validFrequencies = ['EVERY_2_MONTHS', 'EVERY_4_MONTHS', 'EVERY_6_MONTHS', 'EVERY_12_MONTHS'];
      if (!validFrequencies.includes(body.frequency)) {
        return NextResponse.json(
          { error: `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.frequency = body.frequency;

      // Recalculate next delivery based on new frequency
      if (existing.status === 'ACTIVE' || body.status === 'ACTIVE') {
        const now = new Date();
        const daysMap: Record<string, number> = {
          EVERY_2_MONTHS: 60,
          EVERY_4_MONTHS: 120,
          EVERY_6_MONTHS: 180,
          EVERY_12_MONTHS: 365,
        };
        const nextDate = new Date(now.getTime() + daysMap[body.frequency] * 24 * 60 * 60 * 1000);
        updateData.nextDelivery = nextDate;
      }
    }

    // Quantity change
    if (body.quantity !== undefined) {
      if (body.quantity < 1) {
        return NextResponse.json({ error: 'Quantity must be at least 1' }, { status: 400 });
      }
      updateData.quantity = body.quantity;
    }

    // Discount change
    if (body.discountPercent !== undefined) {
      if (body.discountPercent < 0 || body.discountPercent > 100) {
        return NextResponse.json({ error: 'Discount must be between 0 and 100' }, { status: 400 });
      }
      updateData.discountPercent = body.discountPercent;
    }

    // Next delivery date change
    if (body.nextDelivery !== undefined) {
      updateData.nextDelivery = new Date(body.nextDelivery);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: updateData,
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_SUBSCRIPTION',
      targetType: 'Subscription',
      targetId: id,
      previousValue: { status: existing.status, frequency: existing.frequency, quantity: existing.quantity },
      newValue: updateData,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      subscription: {
        ...updated,
        unitPrice: Number(updated.unitPrice),
      },
    });
  } catch (error) {
    console.error('Admin subscription PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/subscriptions/[id] - Cancel subscription
export const DELETE = withAdminGuard(async (_request, { session, params }) => {
  try {
    const id = params!.id;

    const existing = await prisma.subscription.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    if (existing.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Subscription is already cancelled' }, { status: 400 });
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'CANCEL_SUBSCRIPTION',
      targetType: 'Subscription',
      targetId: id,
      previousValue: { status: existing.status, productName: existing.productName },
      newValue: { status: 'CANCELLED' },
      ipAddress: getClientIpFromRequest(_request),
      userAgent: _request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      subscription: {
        ...updated,
        unitPrice: Number(updated.unitPrice),
      },
    });
  } catch (error) {
    console.error('Admin subscription DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
