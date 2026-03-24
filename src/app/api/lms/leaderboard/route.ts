export const dynamic = 'force-dynamic';

/**
 * Student Leaderboard API
 * GET /api/lms/leaderboard — Get leaderboard rankings for current tenant
 */
import { NextRequest, NextResponse } from 'next/server';
import { withUserGuard } from '@/lib/user-api-guard';
import { prisma } from '@/lib/db';

export const GET = withUserGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') ?? 'all_time'; // weekly, monthly, all_time
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);

  // Try materialized leaderboard first
  const leaderboard = await prisma.lmsLeaderboard.findMany({
    where: { tenantId, period },
    orderBy: { rank: 'asc' },
    take: limit,
    select: {
      userId: true,
      coursesCompleted: true,
      totalPoints: true,
      currentStreak: true,
      badgeCount: true,
      rank: true,
    },
  });

  // If empty, compute on-the-fly from enrollments
  if (leaderboard.length === 0) {
    const enrollments = await prisma.enrollment.groupBy({
      by: ['userId'],
      where: { tenantId, status: 'COMPLETED' },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    const computed = enrollments.map((e, i) => ({
      userId: e.userId,
      coursesCompleted: e._count.id,
      totalPoints: e._count.id * 100,
      currentStreak: 0,
      badgeCount: 0,
      rank: i + 1,
    }));

    // Find current user's rank
    const myRank = computed.findIndex(e => e.userId === session.user.id);

    return NextResponse.json({
      data: {
        leaderboard: computed,
        myRank: myRank >= 0 ? myRank + 1 : null,
        period,
        source: 'computed',
      },
    });
  }

  const myEntry = leaderboard.find(e => e.userId === session.user.id);

  return NextResponse.json({
    data: {
      leaderboard,
      myRank: myEntry?.rank ?? null,
      period,
      source: 'materialized',
    },
  });
}, { skipCsrf: true });
