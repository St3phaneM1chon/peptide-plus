export const dynamic = 'force-dynamic';

/**
 * CRM Rep Bonus Tiers API
 * GET    /api/admin/crm/reps/[id]/bonuses - List all active bonus tiers
 * POST   /api/admin/crm/reps/[id]/bonuses - Create a new bonus tier
 * PATCH  /api/admin/crm/reps/[id]/bonuses?tierId=... - Update a tier
 * DELETE /api/admin/crm/reps/[id]/bonuses?tierId=... - Soft delete a tier
 *
 * Note: This route manages bonus tiers globally (not per-agent),
 * but is nested under reps for navigation convenience.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const createTierSchema = z.object({
  name: z.string().min(1),
  commissionType: z.enum(['SALES', 'ACTIVITY', 'HYBRID']),
  revenueThreshold: z.number().nonnegative().optional(),
  commissionRate: z.number().min(0).max(1).optional(),
  activityType: z.enum(['CALLS', 'APPOINTMENTS', 'BOTH']).optional(),
  minVolume: z.number().int().nonnegative().optional(),
  minPrequalScore: z.number().int().min(0).max(100).optional(),
  ratePerCall: z.number().nonnegative().optional(),
  ratePerAppointment: z.number().nonnegative().optional(),
  maxPayout: z.number().nonnegative().optional(),
  period: z.string().optional(),
  priority: z.number().int().nonnegative().optional(),
});

const updateTierSchema = createTierSchema.partial();

// ---------------------------------------------------------------------------
// GET: List all active RepBonusTier, ordered by priority asc
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest, { params }: { session: { user: { id: string; role: string } }; params: Promise<{ id: string }> }) => {
  try {
    await params; // consume params even if not used for this global list

    const tiers = await prisma.repBonusTier.findMany({
      where: { isActive: true },
      orderBy: { priority: 'asc' },
      include: {
        _count: {
          select: { payouts: true },
        },
      },
    });

    return apiSuccess(tiers, { request });
  } catch (error) {
    logger.error('[crm/reps/bonuses] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to list bonus tiers', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.reports.view' });

// ---------------------------------------------------------------------------
// POST: Create a new RepBonusTier
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { params }: { session: { user: { id: string; role: string } }; params: Promise<{ id: string }> }) => {
  try {
    await params;
    const body = await request.json();
    const parsed = createTierSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid request body', ErrorCode.VALIDATION_ERROR, {
        status: 400,
        details: parsed.error.flatten(),
        request,
      });
    }

    const tier = await prisma.repBonusTier.create({
      data: parsed.data,
      include: {
        _count: {
          select: { payouts: true },
        },
      },
    });

    return apiSuccess(tier, { status: 201, request });
  } catch (error) {
    logger.error('[crm/reps/bonuses] POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to create bonus tier', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.reports.edit' });

// ---------------------------------------------------------------------------
// PATCH: Update a tier
// ---------------------------------------------------------------------------

export const PATCH = withAdminGuard(async (request: NextRequest, { params }: { session: { user: { id: string; role: string } }; params: Promise<{ id: string }> }) => {
  try {
    await params;
    const url = new URL(request.url);
    const tierId = url.searchParams.get('tierId');

    if (!tierId) {
      return apiError('tierId query parameter is required', ErrorCode.VALIDATION_ERROR, { status: 400, request });
    }

    const body = await request.json();
    const parsed = updateTierSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid request body', ErrorCode.VALIDATION_ERROR, {
        status: 400,
        details: parsed.error.flatten(),
        request,
      });
    }

    // Verify the tier exists
    const existing = await prisma.repBonusTier.findUnique({ where: { id: tierId } });
    if (!existing) {
      return apiError('Bonus tier not found', ErrorCode.NOT_FOUND, { status: 404, request });
    }

    const updated = await prisma.repBonusTier.update({
      where: { id: tierId },
      data: parsed.data,
      include: {
        _count: {
          select: { payouts: true },
        },
      },
    });

    return apiSuccess(updated, { request });
  } catch (error) {
    logger.error('[crm/reps/bonuses] PATCH error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to update bonus tier', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.reports.edit' });

// ---------------------------------------------------------------------------
// DELETE: Soft delete (set isActive=false)
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (request: NextRequest, { params }: { session: { user: { id: string; role: string } }; params: Promise<{ id: string }> }) => {
  try {
    await params;
    const url = new URL(request.url);
    const tierId = url.searchParams.get('tierId');

    if (!tierId) {
      return apiError('tierId query parameter is required', ErrorCode.VALIDATION_ERROR, { status: 400, request });
    }

    // Verify the tier exists
    const existing = await prisma.repBonusTier.findUnique({ where: { id: tierId } });
    if (!existing) {
      return apiError('Bonus tier not found', ErrorCode.NOT_FOUND, { status: 404, request });
    }

    const updated = await prisma.repBonusTier.update({
      where: { id: tierId },
      data: { isActive: false },
    });

    return apiSuccess(updated, { request });
  } catch (error) {
    logger.error('[crm/reps/bonuses] DELETE error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to deactivate bonus tier', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.reports.edit' });
