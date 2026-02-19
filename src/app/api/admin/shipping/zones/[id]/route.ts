export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';

/**
 * PATCH /api/admin/shipping/zones/[id]
 * Update a shipping zone
 */
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();

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

    if (body.name !== undefined) updateData.name = body.name;
    if (body.countries !== undefined) {
      updateData.countries = Array.isArray(body.countries)
        ? JSON.stringify(body.countries)
        : body.countries;
    }
    if (body.baseFee !== undefined) updateData.baseFee = body.baseFee;
    if (body.perItemFee !== undefined) updateData.perItemFee = body.perItemFee;
    if (body.freeShippingThreshold !== undefined) {
      updateData.freeShippingThreshold = body.freeShippingThreshold;
    }
    if (body.estimatedDaysMin !== undefined) {
      updateData.estimatedDaysMin = body.estimatedDaysMin;
    }
    if (body.estimatedDaysMax !== undefined) {
      updateData.estimatedDaysMax = body.estimatedDaysMax;
    }
    if (body.maxWeight !== undefined) updateData.maxWeight = body.maxWeight;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

    const zone = await prisma.shippingZone.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, zone });
  } catch (error) {
    console.error('Update shipping zone error:', error);
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete shipping zone error:', error);
    return NextResponse.json(
      { error: 'Error deleting shipping zone' },
      { status: 500 }
    );
  }
});
