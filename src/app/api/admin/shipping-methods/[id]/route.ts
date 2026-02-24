export const dynamic = 'force-dynamic';

/**
 * Admin Shipping Method (single) API
 *
 * GET    /api/admin/shipping-methods/[id]  - Get a single shipping method
 * PUT    /api/admin/shipping-methods/[id]  - Update a shipping method
 * DELETE /api/admin/shipping-methods/[id]  - Delete a shipping method
 *
 * Operates on ShippingZone records (no separate ShippingMethod model exists).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const updateShippingMethodSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  carrier: z.string().max(200).optional(),
  price: z.number().min(0).optional(),
  estimatedDaysMin: z.number().int().min(0).optional(),
  estimatedDaysMax: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  countries: z.union([z.array(z.string()), z.string()]).optional(),
  perItemFee: z.number().min(0).optional(),
  freeShippingThreshold: z.number().min(0).nullable().optional(),
  maxWeight: z.number().min(0).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseCountries(raw: string): string[] {
  try {
    return JSON.parse(raw) as string[];
  } catch (error) {
    console.error('[ShippingMethods] Failed to parse countries JSON:', error);
    return raw ? [raw] : [];
  }
}

function mapZone(zone: {
  id: string;
  name: string;
  countries: string;
  baseFee: unknown;
  perItemFee: unknown;
  freeShippingThreshold: unknown;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  maxWeight: unknown;
  isActive: boolean;
  notes: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: zone.id,
    name: zone.name,
    carrier: zone.notes ?? zone.name,
    price: Number(zone.baseFee),
    estimatedDays: `${zone.estimatedDaysMin}-${zone.estimatedDaysMax}`,
    estimatedDaysMin: zone.estimatedDaysMin,
    estimatedDaysMax: zone.estimatedDaysMax,
    isActive: zone.isActive,
    countries: parseCountries(zone.countries),
    perItemFee: Number(zone.perItemFee),
    freeShippingThreshold: zone.freeShippingThreshold
      ? Number(zone.freeShippingThreshold)
      : null,
    maxWeight: zone.maxWeight ? Number(zone.maxWeight) : null,
    notes: zone.notes,
    sortOrder: zone.sortOrder,
    createdAt: zone.createdAt.toISOString(),
    updatedAt: zone.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// GET /api/admin/shipping-methods/[id]
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (_request: NextRequest, { params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const zone = await prisma.shippingZone.findUnique({ where: { id } });

    if (!zone) {
      return NextResponse.json(
        { error: 'Shipping method not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ shippingMethod: mapZone(zone) });
  } catch (error) {
    logger.error('GET shipping-methods/[id] error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error fetching shipping method' },
      { status: 500 },
    );
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/shipping-methods/[id]
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const existing = await prisma.shippingZone.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Shipping method not found' },
        { status: 404 },
      );
    }

    const body = await request.json();

    const parsed = updateShippingMethodSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 },
      );
    }
    const data = parsed.data;

    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.carrier !== undefined) updateData.notes = data.carrier;
    if (data.price !== undefined) updateData.baseFee = data.price;
    if (data.estimatedDaysMin !== undefined) {
      updateData.estimatedDaysMin = data.estimatedDaysMin;
    }
    if (data.estimatedDaysMax !== undefined) {
      updateData.estimatedDaysMax = data.estimatedDaysMax;
    }
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.countries !== undefined) {
      updateData.countries = JSON.stringify(
        Array.isArray(data.countries) ? data.countries : [data.countries],
      );
    }
    if (data.perItemFee !== undefined) {
      updateData.perItemFee = data.perItemFee;
    }
    if (data.freeShippingThreshold !== undefined) {
      updateData.freeShippingThreshold = data.freeShippingThreshold ?? null;
    }
    if (data.maxWeight !== undefined) {
      updateData.maxWeight = data.maxWeight ?? null;
    }
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

    const zone = await prisma.shippingZone.update({
      where: { id },
      data: updateData,
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_SHIPPING_METHOD',
      targetType: 'ShippingZone',
      targetId: id!,
      previousValue: { name: existing.name, isActive: existing.isActive },
      newValue: updateData,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      shippingMethod: mapZone(zone),
    });
  } catch (error) {
    logger.error('PUT shipping-methods/[id] error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error updating shipping method' },
      { status: 500 },
    );
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/shipping-methods/[id]
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(
  async (request: NextRequest, { session, params }) => {
    try {
      const id = params?.id;
      if (!id) {
        return NextResponse.json(
          { error: 'ID is required' },
          { status: 400 },
        );
      }

      const existing = await prisma.shippingZone.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json(
          { error: 'Shipping method not found' },
          { status: 404 },
        );
      }

      await prisma.shippingZone.delete({ where: { id } });

      logAdminAction({
        adminUserId: session.user.id,
        action: 'DELETE_SHIPPING_METHOD',
        targetType: 'ShippingZone',
        targetId: id!,
        previousValue: { name: existing.name },
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch(() => {});

      return NextResponse.json({ success: true });
    } catch (error) {
      logger.error('DELETE shipping-methods/[id] error', { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json(
        { error: 'Error deleting shipping method' },
        { status: 500 },
      );
    }
  },
);
