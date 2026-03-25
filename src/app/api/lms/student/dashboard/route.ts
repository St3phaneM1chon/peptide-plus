export const dynamic = 'force-dynamic';

/**
 * Student Dashboard Aggregation API
 * GET /api/lms/student/dashboard — badges, streak, stats, deadlines
 *
 * SEC-HARDENING: Wrapped with withUserGuard for centralized auth + rate limiting.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withUserGuard } from '@/lib/user-api-guard';
import { prisma } from '@/lib/db';

export const GET = withUserGuard(async (_request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 403 });
  }

  const userId = session.user.id!;

  // Run all queries in parallel
  const [badgeAwards, streak, enrollments, deadlines] = await Promise.all([
    // Badges earned by this user
    prisma.lmsBadgeAward.findMany({
      where: { tenantId, userId },
      include: {
        badge: {
          select: { name: true, iconUrl: true, description: true },
        },
      },
      orderBy: { awardedAt: 'desc' },
      take: 50,
    }),

    // Streak
    prisma.lmsStreak.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      select: { currentStreak: true, longestStreak: true, lastActivityDate: true },
    }),

    // All enrollments for stats
    prisma.enrollment.findMany({
      where: { tenantId, userId },
      select: {
        status: true,
        progress: true,
        lessonsCompleted: true,
        totalLessons: true,
        completedAt: true,
        complianceDeadline: true,
        complianceStatus: true,
        course: {
          select: {
            title: true,
            slug: true,
            estimatedHours: true,
          },
        },
      },
    }),

    // Upcoming compliance deadlines
    prisma.enrollment.findMany({
      where: {
        tenantId,
        userId,
        complianceDeadline: { not: null },
        status: { in: ['ACTIVE'] },
      },
      select: {
        complianceDeadline: true,
        complianceStatus: true,
        course: {
          select: { title: true, slug: true },
        },
      },
      orderBy: { complianceDeadline: 'asc' },
      take: 10,
    }),
  ]);

  // Format badges
  const badges = badgeAwards.map(ba => ({
    name: ba.badge.name,
    icon: ba.badge.iconUrl ?? '🏅',
    description: ba.badge.description ?? '',
    earnedAt: ba.awardedAt.toISOString(),
  }));

  // Compute stats
  const totalCourses = enrollments.length;
  const completed = enrollments.filter(e => e.status === 'COMPLETED').length;
  const inProgress = enrollments.filter(e => e.status === 'ACTIVE').length;
  const totalHoursSpent = Math.round(
    enrollments.reduce((sum, e) => {
      const hours = Number(e.course.estimatedHours ?? 0);
      const pct = Number(e.progress) / 100;
      return sum + hours * pct;
    }, 0)
  );

  // Format deadlines
  const formattedDeadlines = deadlines
    .filter(d => d.complianceDeadline)
    .map(d => ({
      courseTitle: d.course.title,
      courseSlug: d.course.slug,
      deadline: d.complianceDeadline!.toISOString(),
      status: d.complianceStatus ?? 'IN_PROGRESS',
    }));

  return NextResponse.json({
    badges,
    streak: streak?.currentStreak ?? 0,
    stats: {
      totalCourses,
      completed,
      inProgress,
      totalHoursSpent,
    },
    deadlines: formattedDeadlines,
  });
}, { skipCsrf: true });
