export const dynamic = 'force-dynamic';

// FIX: F-080 - Migrated to withAdminGuard for consistent auth + CSRF + rate limiting
// TODO: F-084 - DELETE requires OWNER but PATCH allows EMPLOYEE (can soft-delete via INACTIVE); document or align permissions

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const VALID_STATUSES = ['ACTIVE', 'SUSPENDED', 'PENDING', 'INACTIVE'] as const;
const VALID_TIERS = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const;

const updateAmbassadorSchema = z.object({
  status: z.enum(VALID_STATUSES).optional(),
  tier: z.enum(VALID_TIERS).optional(),
  commissionRate: z.number().min(0).max(100).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

export const GET = withAdminGuard(async (_request: NextRequest, { params }) => {
  try {
    const id = params!.id;

    const ambassador = await prisma.ambassador.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        name: true,
        email: true,
        referralCode: true,
        commissionRate: true,
        totalReferrals: true,
        totalEarnings: true,
        status: true,
        tier: true,
        joinedAt: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        commissions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            orderId: true,
            orderNumber: true,
            orderTotal: true,
            commissionRate: true,
            commissionAmount: true,
            paidOut: true,
            paidOutAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!ambassador) {
      // FIX: F-096 - Return error codes alongside French text for client-side translation
      return NextResponse.json({ error: 'Ambassadeur non trouvé', errorCode: 'AMBASSADOR_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({ ambassador });
  } catch (error) {
    logger.error('Get ambassador error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur serveur', errorCode: 'AMBASSADOR_FETCH_FAILED' }, { status: 500 });
  }
});

export const PATCH = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();

    const parsed = updateAmbassadorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', errorCode: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Check ambassador exists
    const existing = await prisma.ambassador.findUnique({
      where: { id },
      select: { id: true, status: true, tier: true, commissionRate: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Ambassadeur non trouvé', errorCode: 'AMBASSADOR_NOT_FOUND' }, { status: 404 });
    }

    // Build update data from validated fields
    const updateData: Record<string, unknown> = {};
    const { status, tier, commissionRate } = parsed.data;

    if (status !== undefined) updateData.status = status;
    if (tier !== undefined) updateData.tier = tier;
    if (commissionRate !== undefined) updateData.commissionRate = commissionRate;

    const ambassador = await prisma.ambassador.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        userId: true,
        name: true,
        email: true,
        referralCode: true,
        commissionRate: true,
        totalReferrals: true,
        totalEarnings: true,
        status: true,
        tier: true,
        joinedAt: true,
      },
    });

    // Audit log
    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_AMBASSADOR',
      targetType: 'Ambassador',
      targetId: id,
      previousValue: { status: existing.status, tier: existing.tier, commissionRate: Number(existing.commissionRate) },
      newValue: updateData,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ ambassador });
  } catch (error) {
    logger.error('Update ambassador error', { error: error instanceof Error ? error.message : String(error) });
    // FIX: F-096 - Return error codes alongside French text
    return NextResponse.json({ error: 'Erreur serveur', errorCode: 'AMBASSADOR_UPDATE_FAILED' }, { status: 500 });
  }
});

export const DELETE = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const id = params!.id;

    const existing = await prisma.ambassador.findUnique({
      where: { id },
      select: { id: true, name: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Ambassadeur non trouvé', errorCode: 'AMBASSADOR_NOT_FOUND' }, { status: 404 });
    }

    // Soft delete: set status to INACTIVE
    await prisma.ambassador.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_AMBASSADOR',
      targetType: 'Ambassador',
      targetId: id,
      previousValue: { name: existing.name, status: existing.status },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Delete ambassador error', { error: error instanceof Error ? error.message : String(error) });
    // FIX: F-096 - Return error codes alongside French text
    return NextResponse.json({ error: 'Erreur serveur', errorCode: 'AMBASSADOR_DELETE_FAILED' }, { status: 500 });
  }
});
