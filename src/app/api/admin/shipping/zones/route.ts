export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';

/**
 * GET /api/admin/shipping/zones
 * List all shipping zones
 */
export const GET = withAdminGuard(async (_request, { session }) => {
  try {
    const zones = await prisma.shippingZone.findMany({
      orderBy: { sortOrder: 'asc' },
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
    console.error('Get shipping zones error:', error);
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
    const {
      name,
      countries,
      baseFee,
      perItemFee,
      freeShippingThreshold,
      estimatedDaysMin,
      estimatedDaysMax,
      maxWeight,
      isActive,
      notes,
      sortOrder,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Zone name is required' },
        { status: 400 }
      );
    }

    if (!countries || !Array.isArray(countries) || countries.length === 0) {
      return NextResponse.json(
        { error: 'At least one country is required' },
        { status: 400 }
      );
    }

    if (baseFee === undefined || baseFee === null) {
      return NextResponse.json(
        { error: 'Base fee is required' },
        { status: 400 }
      );
    }

    const zone = await prisma.shippingZone.create({
      data: {
        name,
        countries: JSON.stringify(countries),
        baseFee,
        perItemFee: perItemFee ?? 0,
        freeShippingThreshold: freeShippingThreshold ?? null,
        estimatedDaysMin: estimatedDaysMin ?? 3,
        estimatedDaysMax: estimatedDaysMax ?? 7,
        maxWeight: maxWeight ?? null,
        isActive: isActive ?? true,
        notes: notes ?? null,
        sortOrder: sortOrder ?? 0,
      },
    });

    return NextResponse.json({ success: true, data: zone }, { status: 201 });
  } catch (error) {
    console.error('Create shipping zone error:', error);
    return NextResponse.json(
      { error: 'Error creating shipping zone' },
      { status: 500 }
    );
  }
});
