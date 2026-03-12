export const dynamic = 'force-dynamic';

/**
 * Customer Segmentation API
 * GET  /api/admin/customers/segments — Dynamic segment query with aggregate stats
 * POST /api/admin/customers/segments — Execute a named segment query (no DB persistence)
 *
 * Segmentation criteria (all optional, combined with AND):
 *   loyaltyTier        — BRONZE | SILVER | GOLD | PLATINUM | DIAMOND
 *   minOrders          — minimum number of orders (from CustomerMetrics)
 *   maxOrders          — maximum number of orders (from CustomerMetrics)
 *   minSpent           — minimum lifetime spend in CAD (from CustomerMetrics)
 *   maxSpent           — maximum lifetime spend in CAD (from CustomerMetrics)
 *   lastOrderBefore    — ISO date: last order placed before this date
 *   lastOrderAfter     — ISO date: last order placed after this date
 *   tags               — comma-separated tag values; match ANY
 *   role               — UserRole value (CUSTOMER, CLIENT, …)
 *   isActive           — "true" → non-banned users; "false" → banned users
 *   page               — page number (default 1)
 *   limit              — page size (default 25, max 200)
 *
 * Response:
 *   { segment, pagination, users[], aggregates }
 *
 * NOTE: No Segment model exists in the schema. Results are dynamic only.
 * The POST endpoint accepts a segment name but does not persist it.
 * To enable persistence, add a CustomerSegment model to schema.prisma.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Validation schema (shared between GET query params and POST body)
// ---------------------------------------------------------------------------

const LOYALTY_TIERS = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'] as const;

const segmentCriteriaSchema = z.object({
  // User-level filters
  loyaltyTier: z.enum(LOYALTY_TIERS).optional(),
  tags:        z.string().optional(), // comma-separated, match any
  role:        z.string().optional(),
  isActive:    z.enum(['true', 'false']).optional(),
  // Metrics-level filters (sourced from CustomerMetrics table)
  minOrders:       z.coerce.number().int().min(0).optional(),
  maxOrders:       z.coerce.number().int().min(0).optional(),
  minSpent:        z.coerce.number().min(0).optional(),
  maxSpent:        z.coerce.number().min(0).optional(),
  lastOrderBefore: z.string().datetime({ offset: true }).optional(),
  lastOrderAfter:  z.string().datetime({ offset: true }).optional(),
  // Pagination
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

type SegmentCriteria = z.infer<typeof segmentCriteriaSchema>;

// ---------------------------------------------------------------------------
// Helpers: build WHERE clauses
// ---------------------------------------------------------------------------

/** Returns a Prisma UserWhereInput for user-level criteria only. */
function buildUserWhere(c: SegmentCriteria): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};

  if (c.loyaltyTier) where.loyaltyTier = c.loyaltyTier;
  if (c.role)        where.role = c.role as Prisma.EnumUserRoleFilter;
  if (c.isActive === 'true')  where.isBanned = false;
  if (c.isActive === 'false') where.isBanned = true;

  if (c.tags) {
    const tagList = c.tags.split(',').map((t) => t.trim()).filter(Boolean);
    if (tagList.length > 0) {
      where.tags = { hasSome: tagList };
    }
  }

  return where;
}

/** Returns a Prisma CustomerMetricsWhereInput for metrics-level criteria. */
function buildMetricsWhere(c: SegmentCriteria): Prisma.CustomerMetricsWhereInput | null {
  const mw: Prisma.CustomerMetricsWhereInput = {};

  if (c.minOrders !== undefined) {
    mw.totalOrders = { ...(typeof mw.totalOrders === 'object' ? mw.totalOrders : {}), gte: c.minOrders };
  }
  if (c.maxOrders !== undefined) {
    mw.totalOrders = { ...(typeof mw.totalOrders === 'object' ? mw.totalOrders : {}), lte: c.maxOrders };
  }
  if (c.minSpent !== undefined) {
    mw.totalSpent = { ...(typeof mw.totalSpent === 'object' ? mw.totalSpent : {}), gte: new Prisma.Decimal(c.minSpent) };
  }
  if (c.maxSpent !== undefined) {
    mw.totalSpent = { ...(typeof mw.totalSpent === 'object' ? mw.totalSpent : {}), lte: new Prisma.Decimal(c.maxSpent) };
  }
  if (c.lastOrderAfter) {
    mw.lastOrderAt = { ...(typeof mw.lastOrderAt === 'object' ? mw.lastOrderAt : {}), gte: new Date(c.lastOrderAfter) };
  }
  if (c.lastOrderBefore) {
    mw.lastOrderAt = { ...(typeof mw.lastOrderAt === 'object' ? mw.lastOrderAt : {}), lte: new Date(c.lastOrderBefore) };
  }

  return Object.keys(mw).length > 0 ? mw : null;
}

// ---------------------------------------------------------------------------
// Core segment query
// ---------------------------------------------------------------------------

async function runSegmentQuery(c: SegmentCriteria) {
  const userWhere    = buildUserWhere(c);
  const metricsWhere = buildMetricsWhere(c);

  const skip = (c.page - 1) * c.limit;

  // When metrics filters are present we must first resolve the eligible userId
  // set from CustomerMetrics, then scope the user query to those IDs.
  let eligibleUserIds: string[] | undefined;

  if (metricsWhere) {
    const metricsRows = await prisma.customerMetrics.findMany({
      where: metricsWhere,
      select: { userId: true },
    });
    eligibleUserIds = metricsRows.map((m) => m.userId).filter((id): id is string => id != null);

    // No users match the metrics filter — bail out early.
    if (eligibleUserIds.length === 0) {
      return {
        users: [],
        pagination: { page: c.page, limit: c.limit, total: 0, pages: 0 },
        aggregates: { totalUsers: 0, totalRevenue: 0, avgOrderValue: 0, avgCustomerSpend: 0 },
      };
    }

    // Merge with user-level WHERE
    userWhere.id = { in: eligibleUserIds };
  }

  // Fetch users (paginated) and total count in parallel
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: userWhere,
      select: {
        id:            true,
        email:         true,
        name:          true,
        role:          true,
        loyaltyTier:   true,
        loyaltyPoints: true,
        lifetimePoints: true,
        createdAt:     true,
        isBanned:      true,
        tags:          true,
        locale:        true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: c.limit,
    }),
    prisma.user.count({ where: userWhere }),
  ]);

  // Fetch CustomerMetrics for the current page's users only (no N+1)
  const pageUserIds = users.map((u) => u.id);
  const metricsRows = pageUserIds.length > 0
    ? await prisma.customerMetrics.findMany({
        where: { userId: { in: pageUserIds } },
        select: {
          userId:        true,
          totalOrders:   true,
          totalSpent:    true,
          avgOrderValue: true,
          lastOrderAt:   true,
          rfmSegment:    true,
          churnScore:    true,
        },
      })
    : [];

  const metricsMap = new Map(metricsRows.map((m) => [m.userId, m]));

  // Segment-level aggregate stats — over ALL matching users, not just current page.
  // We aggregate from CustomerMetrics for the full eligible user set.
  const allMatchingIds = eligibleUserIds ?? (
    // When no metrics filter, get all matching user IDs for aggregation.
    // Cap at 10 000 to avoid memory issues on large tables.
    (await prisma.user.findMany({
      where: userWhere,
      select: { id: true },
      take: 10_000,
    })).map((u) => u.id)
  );

  const aggResult = allMatchingIds.length > 0
    ? await prisma.customerMetrics.aggregate({
        where: { userId: { in: allMatchingIds } },
        _avg: { avgOrderValue: true, totalSpent: true },
        _sum: { totalSpent: true },
      })
    : null;

  const totalRevenue    = Number(aggResult?._sum?.totalSpent  ?? 0);
  const avgOrderValue   = Number(aggResult?._avg?.avgOrderValue ?? 0);
  const avgCustomerSpend = Number(aggResult?._avg?.totalSpent   ?? 0);

  // Shape the user list
  const mapped = users.map((u) => {
    const m = metricsMap.get(u.id);
    return {
      id:            u.id,
      email:         u.email,
      name:          u.name,
      role:          u.role,
      loyaltyTier:   u.loyaltyTier,
      loyaltyPoints: u.loyaltyPoints,
      lifetimePoints: u.lifetimePoints,
      createdAt:     u.createdAt,
      isBanned:      u.isBanned,
      tags:          u.tags,
      locale:        u.locale,
      metrics: m
        ? {
            totalOrders:   m.totalOrders,
            totalSpent:    Number(m.totalSpent),
            avgOrderValue: Number(m.avgOrderValue),
            lastOrderAt:   m.lastOrderAt,
            rfmSegment:    m.rfmSegment,
            churnScore:    Number(m.churnScore),
          }
        : null,
    };
  });

  return {
    users: mapped,
    pagination: {
      page:  c.page,
      limit: c.limit,
      total,
      pages: Math.ceil(total / c.limit),
    },
    aggregates: {
      totalUsers:        total,
      totalRevenue:      Math.round(totalRevenue    * 100) / 100,
      avgOrderValue:     Math.round(avgOrderValue   * 100) / 100,
      avgCustomerSpend:  Math.round(avgCustomerSpend * 100) / 100,
    },
  };
}

// ---------------------------------------------------------------------------
// GET /api/admin/customers/segments
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);

    const raw: Record<string, string | undefined> = {
      loyaltyTier:     searchParams.get('loyaltyTier')     ?? undefined,
      minOrders:       searchParams.get('minOrders')       ?? undefined,
      maxOrders:       searchParams.get('maxOrders')       ?? undefined,
      minSpent:        searchParams.get('minSpent')        ?? undefined,
      maxSpent:        searchParams.get('maxSpent')        ?? undefined,
      lastOrderBefore: searchParams.get('lastOrderBefore') ?? undefined,
      lastOrderAfter:  searchParams.get('lastOrderAfter')  ?? undefined,
      tags:            searchParams.get('tags')            ?? undefined,
      role:            searchParams.get('role')            ?? undefined,
      isActive:        searchParams.get('isActive')        ?? undefined,
      page:            searchParams.get('page')            ?? undefined,
      limit:           searchParams.get('limit')           ?? undefined,
    };

    const parsed = segmentCriteriaSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await runSegmentQuery(parsed.data);

    logger.info('[customers/segments] GET segment query', {
      criteria: parsed.data,
      total: result.pagination.total,
    });

    return NextResponse.json({
      segment: {
        name:     'Dynamic segment',
        criteria: parsed.data,
      },
      ...result,
    });
  } catch (error) {
    logger.error('[customers/segments] GET error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: 'Failed to query segment' }, { status: 500 });
  }
}, { skipCsrf: true });

// ---------------------------------------------------------------------------
// POST /api/admin/customers/segments
// ---------------------------------------------------------------------------
// No Segment model in the schema — execute the query and return results
// immediately. The segment name is for display only; nothing is persisted.
// ---------------------------------------------------------------------------

const postBodySchema = segmentCriteriaSchema.extend({
  name: z.string().min(1).max(120).default('Unnamed segment'),
});

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = postBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, ...criteria } = parsed.data;

    const result = await runSegmentQuery(criteria);

    logger.info('[customers/segments] POST named segment query', {
      name,
      criteria,
      total: result.pagination.total,
    });

    return NextResponse.json({
      segment: {
        name,
        criteria,
        persisted: false,
        note: 'No Segment model in schema — results are dynamic and not saved.',
      },
      ...result,
    });
  } catch (error) {
    logger.error('[customers/segments] POST error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: 'Failed to execute segment query' }, { status: 500 });
  }
});
