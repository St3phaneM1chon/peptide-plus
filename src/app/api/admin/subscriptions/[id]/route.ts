export const dynamic = 'force-dynamic';

/**
 * Admin Subscription Detail API
 * GET    - Single subscription detail
 * PATCH  - Update subscription (pause, resume, cancel, change frequency)
 * DELETE - Cancel subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const updateSubscriptionSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'CANCELLED', 'PENDING_PAYMENT']).nullish(),
  frequency: z.enum(['EVERY_2_MONTHS', 'EVERY_4_MONTHS', 'EVERY_6_MONTHS', 'EVERY_12_MONTHS']).nullish(),
  quantity: z.number().int().min(1).nullish(),
  discountPercent: z.number().min(0).max(100).nullish(),
  nextDelivery: z.string().nullish(),
});

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
    logger.error('Admin subscription GET error', { error: error instanceof Error ? error.message : String(error) });
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
    const parsed = updateSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const existing = await prisma.subscription.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    const data = parsed.data;
    const updateData: Record<string, unknown> = {};

    // Status changes: pause, resume, cancel
    if (data.status !== undefined && data.status !== null) {
      // Validate transitions
      if (data.status === 'ACTIVE' && existing.status === 'CANCELLED') {
        return NextResponse.json(
          { error: 'Cannot reactivate a cancelled subscription' },
          { status: 400 }
        );
      }

      updateData.status = data.status;

      if (data.status === 'CANCELLED') {
        updateData.cancelledAt = new Date();
      }
    }

    // Frequency change
    if (data.frequency !== undefined && data.frequency !== null) {
      updateData.frequency = data.frequency;

      // Recalculate next delivery based on new frequency
      if (existing.status === 'ACTIVE' || data.status === 'ACTIVE') {
        const now = new Date();
        const daysMap: Record<string, number> = {
          EVERY_2_MONTHS: 60,
          EVERY_4_MONTHS: 120,
          EVERY_6_MONTHS: 180,
          EVERY_12_MONTHS: 365,
        };
        const nextDate = new Date(now.getTime() + daysMap[data.frequency] * 24 * 60 * 60 * 1000);
        updateData.nextDelivery = nextDate;
      }
    }

    // Quantity change
    if (data.quantity !== undefined && data.quantity !== null) {
      updateData.quantity = data.quantity;
    }

    // Discount change
    if (data.discountPercent !== undefined && data.discountPercent !== null) {
      updateData.discountPercent = data.discountPercent;
    }

    // Next delivery date change
    if (data.nextDelivery !== undefined && data.nextDelivery !== null) {
      updateData.nextDelivery = new Date(data.nextDelivery);
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
    logger.error('Admin subscription PATCH error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/subscriptions/[id] - Cancel subscription
export const DELETE = withAdminGuard(async (request, { session, params }) => {
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
    logger.error('Admin subscription DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
