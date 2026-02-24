export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { patchShippingZoneSchema } from '@/lib/validations/shipping';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

/**
 * PATCH /api/admin/shipping/zones/[id]
 * Update a shipping zone
 */
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();

    // Validate with Zod
    const parsed = patchShippingZoneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const existing = await prisma.shippingZone.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Shipping zone not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.countries !== undefined) {
      updateData.countries = JSON.stringify(data.countries);
    }
    if (data.baseFee !== undefined) updateData.baseFee = data.baseFee;
    if (data.perItemFee !== undefined) updateData.perItemFee = data.perItemFee;
    if (data.freeShippingThreshold !== undefined) {
      updateData.freeShippingThreshold = data.freeShippingThreshold;
    }
    if (data.estimatedDaysMin !== undefined) {
      updateData.estimatedDaysMin = data.estimatedDaysMin;
    }
    if (data.estimatedDaysMax !== undefined) {
      updateData.estimatedDaysMax = data.estimatedDaysMax;
    }
    if (data.maxWeight !== undefined) updateData.maxWeight = data.maxWeight;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

    const zone = await prisma.shippingZone.update({
      where: { id },
      data: updateData,
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_SHIPPING_ZONE',
      targetType: 'ShippingZone',
      targetId: id,
      previousValue: { name: existing.name, isActive: existing.isActive },
      newValue: updateData,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true, data: zone });
  } catch (error) {
    logger.error('Update shipping zone error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error updating shipping zone' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/admin/shipping/zones/[id]
 * Delete a shipping zone
 */
export const DELETE = withAdminGuard(async (_request, { session, params }) => {
  try {
    const id = params!.id;

    const existing = await prisma.shippingZone.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Shipping zone not found' },
        { status: 404 }
      );
    }

    await prisma.shippingZone.delete({ where: { id } });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_SHIPPING_ZONE',
      targetType: 'ShippingZone',
      targetId: id,
      previousValue: { name: existing.name },
      ipAddress: getClientIpFromRequest(_request),
      userAgent: _request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Delete shipping zone error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error deleting shipping zone' },
      { status: 500 }
    );
  }
});
