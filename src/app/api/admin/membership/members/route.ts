export const dynamic = 'force-dynamic';

/**
 * Admin Membership Members API
 * GET  - List members with filters (plan, status, search)
 * POST - Manually add a member to a plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const addMemberSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  planId: z.string().min(1, 'Plan ID is required'),
  status: z.enum(['active', 'trialing', 'paused']).default('active'),
  endDate: z.string().datetime().optional().nullable(),
  trialEndsAt: z.string().datetime().optional().nullable(),
});

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const skip = (page - 1) * limit;
    const status = searchParams.get('status');
    const planId = searchParams.get('planId');
    const search = searchParams.get('search');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (status) where.status = status;
    if (planId) where.planId = planId;
    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [members, total] = await Promise.all([
      prisma.membership.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
          plan: { select: { id: true, name: true, slug: true, interval: true, price: true, currency: true } },
        },
      }),
      prisma.membership.count({ where }),
    ]);

    return NextResponse.json({ data: members, total, page, limit });
  } catch (error) {
    logger.error('[MembershipMembers] GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = addMemberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { userId, planId, status, endDate, trialEndsAt } = parsed.data;

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify plan exists and is active
    const plan = await prisma.membershipPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }
    if (!plan.isActive) {
      return NextResponse.json({ error: 'Plan is not active' }, { status: 400 });
    }

    // Check max members limit
    if (plan.maxMembers) {
      const currentCount = await prisma.membership.count({
        where: { planId, status: { in: ['active', 'trialing'] } },
      });
      if (currentCount >= plan.maxMembers) {
        return NextResponse.json({ error: 'Plan has reached maximum members' }, { status: 409 });
      }
    }

    // Check if already a member of this plan
    const existing = await prisma.membership.findFirst({
      where: { userId, planId, status: { in: ['active', 'trialing'] } },
    });
    if (existing) {
      return NextResponse.json({ error: 'User is already an active member of this plan' }, { status: 409 });
    }

    const membership = await prisma.membership.create({
      data: {
        userId,
        planId,
        status,
        endDate: endDate ? new Date(endDate) : null,
        trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null,
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        plan: { select: { id: true, name: true, slug: true, interval: true, price: true } },
      },
    });

    return NextResponse.json(membership, { status: 201 });
  } catch (error) {
    logger.error('[MembershipMembers] POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
