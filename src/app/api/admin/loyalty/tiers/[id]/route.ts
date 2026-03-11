export const dynamic = 'force-dynamic';

/**
 * Admin Loyalty Tier Config - Single Resource
 * GET    - Get a tier config by ID
 * PUT    - Update a tier config
 * DELETE - Delete a tier config (cascades to ProductTierPrice)
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

const updateTierConfigSchema = z.object({
  minPoints: z.number().int().min(0).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  pointsMultiplier: z.number().min(0.01).max(99).optional(),
  freeShippingThreshold: z.number().min(0).nullable().optional(),
  priority: z.number().int().min(0).optional(),
});

// ---------------------------------------------------------------------------
// GET /api/admin/loyalty/tiers/[id]
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (_request, { params }) => {
  try {
    const id = params?.id as string;
    if (!id) {
      return NextResponse.json({ error: 'Missing tier ID' }, { status: 400 });
    }

    const tier = await prisma.loyaltyTierConfig.findUnique({
      where: { id },
      include: {
        tierPrices: {
          include: {
            product: { select: { id: true, name: true, slug: true, price: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!tier) {
      return NextResponse.json({ error: 'Tier config not found' }, { status: 404 });
    }

    return NextResponse.json({ tier });
  } catch (error) {
    logger.error('Admin loyalty tier GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { requiredPermission: 'products.edit' });

// ---------------------------------------------------------------------------
// PUT /api/admin/loyalty/tiers/[id]
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const id = params?.id as string;
    if (!id) {
      return NextResponse.json({ error: 'Missing tier ID' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = updateTierConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.loyaltyTierConfig.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Tier config not found' }, { status: 404 });
    }

    const tier = await prisma.loyaltyTierConfig.update({
      where: { id },
      data: {
        ...(parsed.data.minPoints !== undefined && { minPoints: parsed.data.minPoints }),
        ...(parsed.data.discountPercent !== undefined && { discountPercent: parsed.data.discountPercent }),
        ...(parsed.data.pointsMultiplier !== undefined && { pointsMultiplier: parsed.data.pointsMultiplier }),
        ...(parsed.data.freeShippingThreshold !== undefined && {
          freeShippingThreshold: parsed.data.freeShippingThreshold,
        }),
        ...(parsed.data.priority !== undefined && { priority: parsed.data.priority }),
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_LOYALTY_TIER_CONFIG',
      targetType: 'LoyaltyTierConfig',
      targetId: tier.id,
      previousValue: {
        discountPercent: Number(existing.discountPercent),
        pointsMultiplier: Number(existing.pointsMultiplier),
        priority: existing.priority,
      },
      newValue: {
        discountPercent: Number(tier.discountPercent),
        pointsMultiplier: Number(tier.pointsMultiplier),
        priority: tier.priority,
      },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch((err) =>
      logger.error('Audit log failed for UPDATE_LOYALTY_TIER_CONFIG', {
        error: err instanceof Error ? err.message : String(err),
      })
    );

    return NextResponse.json({ tier });
  } catch (error) {
    logger.error('Admin loyalty tier PUT error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { requiredPermission: 'products.edit' });

// ---------------------------------------------------------------------------
// DELETE /api/admin/loyalty/tiers/[id]
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const id = params?.id as string;
    if (!id) {
      return NextResponse.json({ error: 'Missing tier ID' }, { status: 400 });
    }

    const existing = await prisma.loyaltyTierConfig.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Tier config not found' }, { status: 404 });
    }

    await prisma.loyaltyTierConfig.delete({ where: { id } });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_LOYALTY_TIER_CONFIG',
      targetType: 'LoyaltyTierConfig',
      targetId: id,
      previousValue: { name: existing.name, priority: existing.priority },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch((err) =>
      logger.error('Audit log failed for DELETE_LOYALTY_TIER_CONFIG', {
        error: err instanceof Error ? err.message : String(err),
      })
    );

    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    logger.error('Admin loyalty tier DELETE error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { requiredPermission: 'products.edit' });
