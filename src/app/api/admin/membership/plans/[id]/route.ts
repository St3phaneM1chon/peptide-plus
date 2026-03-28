export const dynamic = 'force-dynamic';

/**
 * Admin Membership Plan Detail API
 * GET    - Get single plan with members
 * PUT    - Update plan
 * DELETE - Delete plan (only if no active members)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const updatePlanSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(2000).optional().nullable(),
  price: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  interval: z.enum(['monthly', 'yearly', 'one_time', 'free']).optional(),
  features: z.array(z.string()).optional(),
  contentAccess: z.array(z.string()).optional(),
  maxMembers: z.number().int().positive().optional().nullable(),
  trialDays: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  stripePriceId: z.string().optional().nullable(),
});

function extractPlanId(request: NextRequest): string {
  const segments = new URL(request.url).pathname.split('/');
  // .../plans/[id] → id is the last segment
  return segments[segments.length - 1];
}

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const id = extractPlanId(request);

    const plan = await prisma.membershipPlan.findUnique({
      where: { id },
      include: {
        members: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
        _count: { select: { members: true } },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    return NextResponse.json(plan);
  } catch (error) {
    logger.error('[MembershipPlan] GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const PUT = withAdminGuard(async (request: NextRequest) => {
  try {
    const id = extractPlanId(request);
    const body = await request.json();
    const parsed = updatePlanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Verify plan exists
    const existing = await prisma.membershipPlan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // If slug changed, check uniqueness
    if (parsed.data.slug && parsed.data.slug !== existing.slug) {
      const slugConflict = await prisma.membershipPlan.findFirst({
        where: { slug: parsed.data.slug, id: { not: id } },
      });
      if (slugConflict) {
        return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
      }
    }

    const plan = await prisma.membershipPlan.update({
      where: { id },
      data: parsed.data,
      include: { _count: { select: { members: true } } },
    });

    return NextResponse.json(plan);
  } catch (error) {
    logger.error('[MembershipPlan] PUT error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const DELETE = withAdminGuard(async (request: NextRequest) => {
  try {
    const id = extractPlanId(request);

    // Check for active members before deleting
    const activeMembers = await prisma.membership.count({
      where: { planId: id, status: { in: ['active', 'trialing'] } },
    });

    if (activeMembers > 0) {
      return NextResponse.json(
        { error: `Cannot delete plan with ${activeMembers} active member(s). Deactivate first or cancel their memberships.` },
        { status: 409 }
      );
    }

    await prisma.membershipPlan.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[MembershipPlan] DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
