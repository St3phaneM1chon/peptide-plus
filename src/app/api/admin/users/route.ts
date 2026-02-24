export const dynamic = 'force-dynamic';

/**
 * Admin Users API
 * GET - List users with filtering, pagination, and search
 *
 * TODO (item 75): Customer Merge API
 * Add POST /api/admin/users/merge endpoint to consolidate duplicate customer records:
 *   - Input: { primaryUserId, duplicateUserIds: string[] }
 *   - Merge logic (all in a single transaction):
 *     1. Reassign all Orders from duplicate users to primary user
 *     2. Reassign all LoyaltyTransactions and sum loyaltyPoints/lifetimePoints
 *     3. Merge CartItems into primary user's cart
 *     4. Reassign Reviews, Questions, Referrals
 *     5. Merge newsletter subscriptions (keep active if either was active)
 *     6. Keep the highest loyaltyTier among all merged accounts
 *     7. Preserve primary user's auth credentials (email, password hash)
 *     8. Soft-delete duplicate user records (set deletedAt, role='MERGED')
 *     9. Create AuditLog entries for the merge operation
 *     10. Send notification email to primary user about account consolidation
 *   - Validation:
 *     - Cannot merge OWNER or EMPLOYEE accounts
 *     - Require confirmation (dryRun mode to preview changes)
 *     - Return summary of what was merged (order count, points transferred, etc.)
 *
 * TODO (item 84): Customer Segmentation API
 * Add /api/admin/users/segments endpoint for targeted marketing:
 *   - GET /api/admin/users/segments - List saved segments
 *   - POST /api/admin/users/segments - Create segment with rules:
 *     {
 *       name: "High-value inactive",
 *       rules: [
 *         { field: "totalSpent", operator: "gte", value: 500 },
 *         { field: "lastOrderDate", operator: "lt", value: "90_days_ago" },
 *         { field: "loyaltyTier", operator: "in", value: ["GOLD", "PLATINUM"] }
 *       ],
 *       combineWith: "AND"
 *     }
 *   - GET /api/admin/users/segments/[id]/members - Get users matching segment
 *   - POST /api/admin/users/segments/[id]/export - Export segment as CSV
 *   - Segment rules engine should support fields:
 *     totalSpent, orderCount, lastOrderDate, loyaltyTier, loyaltyPoints,
 *     registrationDate, locale, city, country, hasSubscription, averageOrderValue
 *   - Store segments in a new CustomerSegment model or as SiteSetting JSON
 *   - Integration with newsletter campaigns for targeted email sends
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const tier = searchParams.get('tier');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (role) where.role = role;
    if (tier) where.loyaltyTier = tier;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          role: true,
          phone: true,
          locale: true,
          loyaltyPoints: true,
          lifetimePoints: true,
          loyaltyTier: true,
          referralCode: true,
          createdAt: true,
          _count: {
            select: { purchases: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    // Calculate totalSpent per user in a SINGLE query instead of N+1 queries
    const userIds = users.map((u) => u.id);
    const orderTotals = userIds.length > 0
      ? await prisma.order.groupBy({
          by: ['userId'],
          where: { userId: { in: userIds }, paymentStatus: 'PAID' },
          _sum: { total: true },
        })
      : [];

    const spentMap = new Map(
      orderTotals.map((row) => [row.userId, Number(row._sum.total || 0)])
    );

    // G1-FLAW-08: Mask phone numbers in list view
    const usersWithSpent = users.map((user) => ({
      ...user,
      phone: user.phone ? '*'.repeat(Math.max(0, user.phone.length - 4)) + user.phone.slice(-4) : null,
      totalSpent: spentMap.get(user.id) || 0,
    }));

    return NextResponse.json({
      users: usersWithSpent,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Admin users API error', { error: error instanceof Error ? error.message : String(error) });
    // SEC-33: Return 500 status on error instead of 200
    return NextResponse.json({ error: 'Internal server error', users: [] }, { status: 500 });
  }
});
