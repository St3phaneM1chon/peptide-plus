export const dynamic = 'force-dynamic';

/**
 * Admin Shipping Methods API
 *
 * GET  /api/admin/shipping-methods  - List all shipping methods (zones)
 * POST /api/admin/shipping-methods  - Create a new shipping method (zone)
 *
 * NOTE: The Prisma schema has no dedicated ShippingMethod model.
 * Shipping methods are represented by ShippingZone records. Each zone
 * encapsulates name, carrier (via notes/name), price (baseFee),
 * estimatedDays, and an isActive flag. This API wraps ShippingZone
 * with a shipping-method-centric interface so the admin UI can manage
 * them as "methods".
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';

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
// GET /api/admin/shipping-methods
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async () => {
  try {
    const zones = await prisma.shippingZone.findMany({
      take: 100,
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      shippingMethods: zones.map(mapZone),
      total: zones.length,
    });
  } catch (error) {
    console.error('GET shipping-methods error:', error);
    return NextResponse.json(
      { error: 'Error fetching shipping methods' },
      { status: 500 },
    );
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/shipping-methods
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();
    const {
      name,
      carrier,
      price,
      estimatedDaysMin,
      estimatedDaysMax,
      isActive,
      countries,
      perItemFee,
      freeShippingThreshold,
      maxWeight,
      notes,
      sortOrder,
    } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 },
      );
    }

    if (price === undefined || price === null || Number(price) < 0) {
      return NextResponse.json(
        { error: 'price is required and must be >= 0' },
        { status: 400 },
      );
    }

    const zone = await prisma.shippingZone.create({
      data: {
        name: name.trim(),
        countries: countries
          ? JSON.stringify(
              Array.isArray(countries) ? countries : [countries],
            )
          : '[]',
        baseFee: Number(price),
        perItemFee: perItemFee != null ? Number(perItemFee) : 0,
        freeShippingThreshold:
          freeShippingThreshold != null
            ? Number(freeShippingThreshold)
            : null,
        estimatedDaysMin:
          estimatedDaysMin != null ? Number(estimatedDaysMin) : 3,
        estimatedDaysMax:
          estimatedDaysMax != null ? Number(estimatedDaysMax) : 7,
        maxWeight: maxWeight != null ? Number(maxWeight) : null,
        isActive: isActive ?? true,
        notes: carrier || notes || null,
        sortOrder: sortOrder ?? 0,
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'CREATE_SHIPPING_METHOD',
      targetType: 'ShippingZone',
      targetId: zone.id,
      newValue: { name, carrier, price, isActive: isActive ?? true },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json(
      { success: true, shippingMethod: mapZone(zone) },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST shipping-methods error:', error);
    return NextResponse.json(
      { error: 'Error creating shipping method' },
      { status: 500 },
    );
  }
});
