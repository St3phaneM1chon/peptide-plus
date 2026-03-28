export const dynamic = 'force-dynamic';

/**
 * Admin Membership Plans API
 * GET  - List all membership plans with member counts
 * POST - Create a new membership plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const createPlanSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(2000).optional().nullable(),
  price: z.number().min(0).default(0),
  currency: z.string().length(3).default('CAD'),
  interval: z.enum(['monthly', 'yearly', 'one_time', 'free']).default('monthly'),
  features: z.array(z.string()).default([]),
  contentAccess: z.array(z.string()).default([]),
  maxMembers: z.number().int().positive().optional().nullable(),
  trialDays: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  stripePriceId: z.string().optional().nullable(),
});

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const skip = (page - 1) * limit;
    const activeOnly = searchParams.get('active') === 'true';

    const where: Record<string, unknown> = {};
    if (activeOnly) where.isActive = true;

    const [plans, total] = await Promise.all([
      prisma.membershipPlan.findMany({
        where,
        take: limit,
        skip,
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          tenantId: true,
          name: true,
          slug: true,
          description: true,
          price: true,
          currency: true,
          interval: true,
          features: true,
          contentAccess: true,
          maxMembers: true,
          trialDays: true,
          isActive: true,
          sortOrder: true,
          stripePriceId: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { members: true } },
        },
      }),
      prisma.membershipPlan.count({ where }),
    ]);

    return NextResponse.json({ data: plans, total, page, limit });
  } catch (error) {
    logger.error('[MembershipPlans] GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = createPlanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check unique slug
    const existing = await prisma.membershipPlan.findFirst({
      where: { slug: data.slug },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'A plan with this slug already exists' },
        { status: 409 }
      );
    }

    const plan = await prisma.membershipPlan.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        price: data.price,
        currency: data.currency,
        interval: data.interval,
        features: data.features,
        contentAccess: data.contentAccess,
        maxMembers: data.maxMembers,
        trialDays: data.trialDays,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
        stripePriceId: data.stripePriceId,
      },
      include: { _count: { select: { members: true } } },
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    logger.error('[MembershipPlans] POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
