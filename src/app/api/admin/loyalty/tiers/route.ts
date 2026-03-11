export const dynamic = 'force-dynamic';

/**
 * Admin Loyalty Tier Config API
 * GET  - List all tier configurations
 * POST - Create or upsert a tier configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const createTierConfigSchema = z.object({
  name: z.string().min(1).max(50).toUpperCase(),
  minPoints: z.number().int().min(0).default(0),
  discountPercent: z.number().min(0).max(100).default(0),
  pointsMultiplier: z.number().min(0.01).max(99).default(1),
  freeShippingThreshold: z.number().min(0).nullable().optional(),
  priority: z.number().int().min(0).default(0),
});

// ---------------------------------------------------------------------------
// GET /api/admin/loyalty/tiers
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async () => {
  try {
    const tiers = await prisma.loyaltyTierConfig.findMany({
      orderBy: { priority: 'asc' },
      include: {
        _count: { select: { tierPrices: true } },
      },
    });

    return NextResponse.json({ tiers });
  } catch (error) {
    logger.error('Admin loyalty tiers GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { requiredPermission: 'products.edit' });

// ---------------------------------------------------------------------------
// POST /api/admin/loyalty/tiers
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();
    const parsed = createTierConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const tier = await prisma.loyaltyTierConfig.upsert({
      where: { name: data.name },
      update: {
        minPoints: data.minPoints,
        discountPercent: data.discountPercent,
        pointsMultiplier: data.pointsMultiplier,
        freeShippingThreshold: data.freeShippingThreshold ?? null,
        priority: data.priority,
      },
      create: {
        name: data.name,
        minPoints: data.minPoints,
        discountPercent: data.discountPercent,
        pointsMultiplier: data.pointsMultiplier,
        freeShippingThreshold: data.freeShippingThreshold ?? null,
        priority: data.priority,
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPSERT_LOYALTY_TIER_CONFIG',
      targetType: 'LoyaltyTierConfig',
      targetId: tier.id,
      newValue: {
        name: tier.name,
        discountPercent: Number(tier.discountPercent),
        pointsMultiplier: Number(tier.pointsMultiplier),
        priority: tier.priority,
      },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch((err) =>
      logger.error('Audit log failed for UPSERT_LOYALTY_TIER_CONFIG', {
        error: err instanceof Error ? err.message : String(err),
      })
    );

    return NextResponse.json({ tier }, { status: 201 });
  } catch (error) {
    logger.error('Admin loyalty tiers POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { requiredPermission: 'products.edit' });
