export const dynamic = 'force-dynamic';

/**
 * Admin - At-Risk Customers API
 *
 * GET /api/admin/customers/at-risk
 *   Returns paginated list of customers at risk of churning.
 *
 * A customer is considered at-risk if they meet ANY of the following criteria:
 *   1. CustomerMetrics.churnScore > 0.7
 *   2. CustomerMetrics.lastOrderDays > 90 AND totalOrders >= 2
 *
 * Response fields per customer:
 *   id, name, email, lastOrderAt, totalOrders, totalSpent,
 *   churnScore, lastOrderDays, rfmSegment
 *
 * Sorted by churn risk (highest churnScore first, then highest lastOrderDays).
 *
 * Query parameters:
 *   page    - page number, default 1
 *   limit   - records per page, default 20, max 100
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(
  async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
      const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
      const skip = (page - 1) * limit;

      // ── 1. Fetch at-risk metrics ─────────────────────────────────────────
      // Criteria: churnScore > 0.7 OR (lastOrderDays > 90 AND totalOrders >= 2)
      const where = {
        OR: [
          { churnScore: { gt: 0.7 } },
          {
            lastOrderDays: { gt: 90 },
            totalOrders: { gte: 2 },
          },
        ],
      };

      const [atRiskMetrics, total] = await Promise.all([
        prisma.customerMetrics.findMany({
          where,
          orderBy: [
            { churnScore: 'desc' },
            { lastOrderDays: 'desc' },
          ],
          skip,
          take: limit,
          select: {
            userId: true,
            churnScore: true,
            lastOrderDays: true,
            totalOrders: true,
            totalSpent: true,
            lastOrderAt: true,
            rfmSegment: true,
          },
        }),
        prisma.customerMetrics.count({ where }),
      ]);

      if (atRiskMetrics.length === 0) {
        return NextResponse.json({
          customers: [],
          pagination: {
            page,
            limit,
            total: 0,
            pages: 0,
          },
        });
      }

      // ── 2. Fetch user details for matched metrics ────────────────────────
      const userIds = atRiskMetrics.map((m) => m.userId).filter((id): id is string => id != null);

      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      const userMap = new Map(users.map((u) => [u.id, u]));

      // ── 3. Build response, preserving order from metrics query ───────────
      const customers = atRiskMetrics
        .map((metrics) => {
          if (!metrics.userId) return null;
          const user = userMap.get(metrics.userId);
          if (!user) return null;

          return {
            id: metrics.userId,
            name: user.name,
            email: user.email,
            lastOrderAt: metrics.lastOrderAt?.toISOString() ?? null,
            totalOrders: metrics.totalOrders,
            totalSpent: Number(metrics.totalSpent),
            churnScore: Number(metrics.churnScore),
            lastOrderDays: metrics.lastOrderDays,
            rfmSegment: metrics.rfmSegment,
          };
        })
        .filter(Boolean);

      logger.info('Admin at-risk customers API: query completed', {
        total,
        page,
        limit,
        returned: customers.length,
      });

      return NextResponse.json({
        customers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error('Admin at-risk customers API error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: 'Internal server error', customers: [] },
        { status: 500 },
      );
    }
  },
  { skipCsrf: true },
);
