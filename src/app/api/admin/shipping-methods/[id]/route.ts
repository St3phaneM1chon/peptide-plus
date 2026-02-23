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
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseCountries(raw: string): string[] {
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return raw ? [raw] : [];
  }
}

function mapZone(z: {
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
    id: z.id,
    name: z.name,
    carrier: z.notes ?? z.name,
    price: Number(z.baseFee),
    estimatedDays: `${z.estimatedDaysMin}-${z.estimatedDaysMax}`,
    estimatedDaysMin: z.estimatedDaysMin,
    estimatedDaysMax: z.estimatedDaysMax,
    isActive: z.isActive,
    countries: parseCountries(z.countries),
    perItemFee: Number(z.perItemFee),
    freeShippingThreshold: z.freeShippingThreshold
      ? Number(z.freeShippingThreshold)
      : null,
    maxWeight: z.maxWeight ? Number(z.maxWeight) : null,
    notes: z.notes,
    sortOrder: z.sortOrder,
    createdAt: z.createdAt.toISOString(),
    updatedAt: z.updatedAt.toISOString(),
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
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.carrier !== undefined) updateData.notes = body.carrier;
    if (body.price !== undefined) updateData.baseFee = Number(body.price);
    if (body.estimatedDaysMin !== undefined) {
      updateData.estimatedDaysMin = Number(body.estimatedDaysMin);
    }
    if (body.estimatedDaysMax !== undefined) {
      updateData.estimatedDaysMax = Number(body.estimatedDaysMax);
    }
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.countries !== undefined) {
      updateData.countries = JSON.stringify(
        Array.isArray(body.countries) ? body.countries : [body.countries],
      );
    }
    if (body.perItemFee !== undefined) {
      updateData.perItemFee = Number(body.perItemFee);
    }
    if (body.freeShippingThreshold !== undefined) {
      updateData.freeShippingThreshold =
        body.freeShippingThreshold != null
          ? Number(body.freeShippingThreshold)
          : null;
    }
    if (body.maxWeight !== undefined) {
      updateData.maxWeight =
        body.maxWeight != null ? Number(body.maxWeight) : null;
    }
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

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
