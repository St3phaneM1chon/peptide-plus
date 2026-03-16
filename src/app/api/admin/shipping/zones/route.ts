export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { createShippingZoneSchema } from '@/lib/validations/shipping';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';
import { getShippingZones as getCalculatorZones } from '@/lib/shipping/calculator';

/**
 * GET /api/admin/shipping/zones
 * List all shipping zones
 */
export const GET = withAdminGuard(async (_request, _ctx) => {
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
      } catch (error) {
        logger.error('[ShippingZones] Failed to parse countries JSON for zone', { zoneId: z.id, error: error instanceof Error ? error.message : String(error) });
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
        { error: 'Invalid data' },
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
    }).catch((err) => { logger.error('[admin/shipping/zones] Non-blocking operation failed:', err); });

    return NextResponse.json({ success: true, data: zone }, { status: 201 });
  } catch (error) {
    logger.error('Create shipping zone error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error creating shipping zone' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/admin/shipping/zones
 * I-SHIPPING: Validate and return the code-level shipping zone constants.
 * Since calculator zones are code constants (not DB-driven), this endpoint
 * validates any submitted zone config against the current constants and
 * returns the authoritative zone configuration.
 *
 * This is useful for admin UIs that want to compare DB zones against
 * the calculator defaults, or to reset zones to defaults.
 */
export const PUT = withAdminGuard(async (request, _ctx) => {
  try {
    const body = await request.json().catch(() => null);

    // Get the authoritative calculator zones (code constants)
    const calculatorZones = getCalculatorZones();

    // If a body was provided, validate it against our zone codes
    let validation: { valid: boolean; errors: string[] } | null = null;
    if (body && typeof body === 'object' && 'zones' in body) {
      const errors: string[] = [];
      const submitted = body.zones as Array<{ code?: string; flatRate?: number; freeThreshold?: number }>;

      if (!Array.isArray(submitted)) {
        errors.push('zones must be an array');
      } else {
        const validCodes = new Set(calculatorZones.map(z => z.code));
        for (const zone of submitted) {
          if (!zone.code || !validCodes.has(zone.code)) {
            errors.push(`Unknown zone code: ${zone.code}. Valid codes: ${[...validCodes].join(', ')}`);
          }
          if (zone.flatRate !== undefined && (typeof zone.flatRate !== 'number' || zone.flatRate < 0)) {
            errors.push(`Invalid flatRate for zone ${zone.code}: must be a non-negative number`);
          }
          if (zone.freeThreshold !== undefined && (typeof zone.freeThreshold !== 'number' || zone.freeThreshold < 0)) {
            errors.push(`Invalid freeThreshold for zone ${zone.code}: must be a non-negative number`);
          }
        }
      }
      validation = { valid: errors.length === 0, errors };
    }

    return NextResponse.json({
      calculatorZones,
      validation,
      message: 'Calculator zone constants are code-defined. Use the DB-backed zones (GET/POST/PATCH) for runtime configuration.',
    });
  } catch (error) {
    logger.error('PUT shipping zones error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error processing zone configuration' },
      { status: 500 }
    );
  }
});
