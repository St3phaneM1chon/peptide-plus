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
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const createShippingMethodSchema = z.object({
  name: z.string().min(1, 'name is required').max(200),
  carrier: z.string().max(200).optional(),
  price: z.number().min(0, 'price must be >= 0'),
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
    logger.error('[ShippingMethods] Failed to parse countries JSON', { error: error instanceof Error ? error.message : String(error) });
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
// GET /api/admin/shipping-methods
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50', 10)), 200);
    const skip = (page - 1) * limit;

    const [zones, total] = await Promise.all([
      prisma.shippingZone.findMany({
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.shippingZone.count(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: zones.map(mapZone),
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    logger.error('GET shipping-methods error', { error: error instanceof Error ? error.message : String(error) });
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

    const parsed = createShippingMethodSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 },
      );
    }
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
    } = parsed.data;

    const zone = await prisma.shippingZone.create({
      data: {
        name: name.trim(),
        countries: countries
          ? JSON.stringify(
              Array.isArray(countries) ? countries : [countries],
            )
          : '[]',
        baseFee: price,
        perItemFee: perItemFee ?? 0,
        freeShippingThreshold: freeShippingThreshold ?? null,
        estimatedDaysMin: estimatedDaysMin ?? 3,
        estimatedDaysMax: estimatedDaysMax ?? 7,
        maxWeight: maxWeight ?? null,
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
    logger.error('POST shipping-methods error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error creating shipping method' },
      { status: 500 },
    );
  }
});
