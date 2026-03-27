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

    // All enrollments for stats + course cards (include chapters/lessons for resume link)
    prisma.enrollment.findMany({
      where: { tenantId, userId },
      select: {
        id: true,
        courseId: true,
        status: true,
        progress: true,
        lessonsCompleted: true,
        totalLessons: true,
        completedAt: true,
        enrolledAt: true,
        complianceDeadline: true,
        complianceStatus: true,
        lessonProgress: {
          where: { isCompleted: true },
          select: { lessonId: true },
        },
        course: {
          select: {
            title: true,
            slug: true,
            estimatedHours: true,
            thumbnailUrl: true,
            chapters: {
              where: { isPublished: true },
              orderBy: { sortOrder: 'asc' },
              select: {
                id: true,
                lessons: {
                  where: { isPublished: true },
                  orderBy: { sortOrder: 'asc' },
                  select: { id: true, title: true },
                },
              },
            },
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

  // Format enrollments for frontend course cards (with resume link)
  const formattedEnrollments = enrollments.map(e => {
    // Compute next incomplete lesson for resume functionality
    const completedIds = new Set(e.lessonProgress.map(lp => lp.lessonId));
    let nextLessonId: string | null = null;
    let nextLessonTitle: string | null = null;
    let nextChapterId: string | null = null;

    for (const ch of e.course.chapters) {
      for (const lesson of ch.lessons) {
        if (!completedIds.has(lesson.id)) {
          nextLessonId = lesson.id;
          nextLessonTitle = lesson.title;
          nextChapterId = ch.id;
          break;
        }
      }
      if (nextLessonId) break;
    }

    // If all lessons completed, point to the first lesson (review mode)
    if (!nextLessonId && e.course.chapters[0]?.lessons[0]) {
      nextLessonId = e.course.chapters[0].lessons[0].id;
      nextLessonTitle = e.course.chapters[0].lessons[0].title;
      nextChapterId = e.course.chapters[0].id;
    }

    return {
      id: e.id,
      courseId: e.courseId,
      courseSlug: e.course.slug,
      courseTitle: e.course.title,
      courseThumbnail: e.course.thumbnailUrl ?? null,
      progress: Number(e.progress),
      lessonsCompleted: e.lessonsCompleted,
      totalLessons: e.totalLessons,
      lastAccessedAt: null,
      nextLessonId,
      nextLessonTitle,
      nextChapterId,
      status: e.status,
      enrolledAt: e.enrolledAt.toISOString(),
      completedAt: e.completedAt?.toISOString() ?? null,
    };
  });

  return NextResponse.json({
    badges,
    streak: streak?.currentStreak ?? 0,
    enrollments: formattedEnrollments,
    stats: {
      totalCourses,
      completed,
      inProgress,
      totalHoursSpent,
    },
    deadlines: formattedDeadlines,
  });
}, { skipCsrf: true });
