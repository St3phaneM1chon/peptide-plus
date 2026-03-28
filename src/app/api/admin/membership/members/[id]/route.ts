export const dynamic = 'force-dynamic';

/**
 * Admin Membership Member Detail API
 * GET    - Get single membership
 * PUT    - Update membership status (cancel, pause, reactivate)
 * DELETE - Remove membership record
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const updateMembershipSchema = z.object({
  status: z.enum(['active', 'cancelled', 'expired', 'paused', 'trialing']).optional(),
  endDate: z.string().datetime().optional().nullable(),
  trialEndsAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

function extractMembershipId(request: NextRequest): string {
  const segments = new URL(request.url).pathname.split('/');
  return segments[segments.length - 1];
}

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const id = extractMembershipId(request);

    const membership = await prisma.membership.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, image: true, role: true } },
        plan: true,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
    }

    return NextResponse.json(membership);
  } catch (error) {
    logger.error('[MembershipMember] GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const PUT = withAdminGuard(async (request: NextRequest) => {
  try {
    const id = extractMembershipId(request);
    const body = await request.json();
    const parsed = updateMembershipSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const existing = await prisma.membership.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = { ...parsed.data };

    // Set timestamps based on status changes
    if (parsed.data.status === 'cancelled' && existing.status !== 'cancelled') {
      updateData.cancelledAt = new Date();
    }
    if (parsed.data.status === 'paused' && existing.status !== 'paused') {
      updateData.pausedAt = new Date();
    }
    // Clear pause date when reactivating
    if (parsed.data.status === 'active' && existing.status === 'paused') {
      updateData.pausedAt = null;
    }

    // Convert date strings
    if (parsed.data.endDate) updateData.endDate = new Date(parsed.data.endDate);
    if (parsed.data.trialEndsAt) updateData.trialEndsAt = new Date(parsed.data.trialEndsAt);

    const membership = await prisma.membership.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        plan: { select: { id: true, name: true, slug: true } },
      },
    });

    return NextResponse.json(membership);
  } catch (error) {
    logger.error('[MembershipMember] PUT error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const DELETE = withAdminGuard(async (request: NextRequest) => {
  try {
    const id = extractMembershipId(request);

    const existing = await prisma.membership.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
    }

    await prisma.membership.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[MembershipMember] DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
