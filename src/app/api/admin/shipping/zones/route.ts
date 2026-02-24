export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { createShippingZoneSchema } from '@/lib/validations/shipping';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/shipping/zones
 * List all shipping zones
 */
export const GET = withAdminGuard(async (_request, { session }) => {
  try {
    const zones = await prisma.shippingZone.findMany({
      orderBy: { sortOrder: 'asc' },
      take: 100,
    });

    // Map to the format the frontend expects
    // The page expects countries as string[] and a methods array
    // Prisma stores countries as a JSON string and has no ShippingMethod relation
    // We synthesize a default method from the zone's own fee/delivery fields
    const mapped = zones.map((z) => {
      let countries: string[] = [];
      try {
        countries = JSON.parse(z.countries);
      } catch {
        countries = z.countries ? [z.countries] : [];
      }

      return {
        id: z.id,
        name: z.name,
        countries,
        baseFee: Number(z.baseFee),
        perItemFee: Number(z.perItemFee),
        freeShippingThreshold: z.freeShippingThreshold
          ? Number(z.freeShippingThreshold)
          : null,
        estimatedDaysMin: z.estimatedDaysMin,
        estimatedDaysMax: z.estimatedDaysMax,
        maxWeight: z.maxWeight ? Number(z.maxWeight) : null,
        isActive: z.isActive,
        notes: z.notes,
        sortOrder: z.sortOrder,
        // Synthesize a default shipping method from the zone data
        // so the frontend table can render it
        methods: [
          {
            id: `${z.id}-default`,
            name: 'Standard',
            carrier: z.name,
            minDays: z.estimatedDaysMin,
            maxDays: z.estimatedDaysMax,
            price: Number(z.baseFee),
            freeAbove: z.freeShippingThreshold
              ? Number(z.freeShippingThreshold)
              : undefined,
            isActive: z.isActive,
          },
        ],
        createdAt: z.createdAt.toISOString(),
        updatedAt: z.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({ zones: mapped });
  } catch (error) {
    logger.error('Get shipping zones error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error fetching shipping zones' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/shipping/zones
 * Create a new shipping zone
 */
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();

    // Validate with Zod
    const parsed = createShippingZoneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const zone = await prisma.shippingZone.create({
      data: {
        name: data.name,
        countries: JSON.stringify(data.countries),
        baseFee: data.baseFee,
        perItemFee: data.perItemFee,
        freeShippingThreshold: data.freeShippingThreshold ?? null,
        estimatedDaysMin: data.estimatedDaysMin,
        estimatedDaysMax: data.estimatedDaysMax,
        maxWeight: data.maxWeight ?? null,
        isActive: data.isActive,
        notes: data.notes ?? null,
        sortOrder: data.sortOrder,
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'CREATE_SHIPPING_ZONE',
      targetType: 'ShippingZone',
      targetId: zone.id,
      newValue: { name: data.name, countries: data.countries, baseFee: data.baseFee, isActive: data.isActive },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true, data: zone }, { status: 201 });
  } catch (error) {
    logger.error('Create shipping zone error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error creating shipping zone' },
      { status: 500 }
    );
  }
});
