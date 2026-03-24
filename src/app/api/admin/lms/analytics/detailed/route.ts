export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess } from '@/lib/api-response';
import { prisma } from '@/lib/db';

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const url = new URL(request.url);
  const range = url.searchParams.get('range') ?? 'month'; // month | 3months | year | all

  // Calculate date filter
  const now = new Date();
  let dateFrom: Date | null = null;
  switch (range) {
    case 'month':
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case '3months':
      dateFrom = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      break;
    case 'year':
      dateFrom = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      break;
    default: // 'all'
      dateFrom = null;
  }

  const enrolledAtFilter = dateFrom ? { enrolledAt: { gte: dateFrom } } : {};
  const completedAtFilter = dateFrom ? { completedAt: { gte: dateFrom } } : {};
  const issuedAtFilter = dateFrom ? { issuedAt: { gte: dateFrom } } : {};
  const quizCompletedAtFilter = dateFrom ? { completedAt: { gte: dateFrom } } : {};

  // --- Stats cards ---
  const [
    totalCourses,
    totalEnrollments,
    completedEnrollments,
    totalCertificates,
    activeStudentsThisMonth,
    atRiskCount,
  ] = await Promise.all([
    prisma.course.count({ where: { tenantId } }),
    prisma.enrollment.count({ where: { tenantId, ...enrolledAtFilter } }),
    prisma.enrollment.count({ where: { tenantId, status: 'COMPLETED', ...completedAtFilter } }),
    prisma.certificate.count({ where: { tenantId, status: 'ISSUED', ...issuedAtFilter } }),
    prisma.enrollment.count({
      where: {
        tenantId,
        status: 'ACTIVE',
        lastAccessedAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
      },
    }),
    prisma.enrollment.count({
      where: {
        tenantId,
        status: 'ACTIVE',
        progress: { lt: 30 },
        complianceDeadline: { not: null },
      },
    }),
  ]);

  const avgCompletionRate = totalEnrollments > 0
    ? Math.round((completedEnrollments / totalEnrollments) * 100)
    : 0;

  // --- Enrollment trend (last 12 months) ---
  // Use raw query to group by month since groupBy on date doesn't aggregate by month
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const allRecentEnrollments = await prisma.enrollment.findMany({
    where: { tenantId, enrolledAt: { gte: twelveMonthsAgo } },
    select: { enrolledAt: true },
  });

  // Aggregate by month
  const monthlyEnrollments: { month: string; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('fr-CA', { month: 'short', year: '2-digit' });
    const count = allRecentEnrollments.filter(e => {
      const ed = new Date(e.enrolledAt);
      return ed.getFullYear() === d.getFullYear() && ed.getMonth() === d.getMonth();
    }).length;
    monthlyEnrollments.push({ month: label, count });
  }

  // --- Completion rate by course ---
  const courses = await prisma.course.findMany({
    where: { tenantId, status: 'PUBLISHED' },
    select: {
      id: true,
      title: true,
      enrollmentCount: true,
      completionCount: true,
    },
    orderBy: { enrollmentCount: 'desc' },
    take: 20,
  });

  const completionByCourse = courses
    .filter(c => c.enrollmentCount > 0)
    .map(c => ({
      courseId: c.id,
      title: c.title,
      enrollments: c.enrollmentCount,
      completions: c.completionCount,
      rate: c.enrollmentCount > 0 ? Math.round((c.completionCount / c.enrollmentCount) * 100) : 0,
    }))
    .slice(0, 10);

  // --- Top 5 courses by enrollment ---
  const topCourses = courses.slice(0, 5).map((c, i) => ({
    rank: i + 1,
    title: c.title,
    enrollments: c.enrollmentCount,
  }));

  // --- Quiz pass rate ---
  const quizStats = await prisma.quizAttempt.groupBy({
    by: ['quizId'],
    where: { tenantId, ...quizCompletedAtFilter },
    _count: { id: true },
    _avg: { score: true },
  });

  const quizPassCounts = await prisma.quizAttempt.groupBy({
    by: ['quizId'],
    where: { tenantId, passed: true, ...quizCompletedAtFilter },
    _count: { id: true },
  });

  const quizPassMap = new Map(quizPassCounts.map(q => [q.quizId, q._count.id]));

  // Get quiz titles
  const quizIds = quizStats.map(q => q.quizId);
  const quizzes = quizIds.length > 0
    ? await prisma.quiz.findMany({
        where: { id: { in: quizIds }, tenantId },
        select: { id: true, title: true },
      })
    : [];
  const quizTitleMap = new Map(quizzes.map(q => [q.id, q.title]));

  const quizPassRates = quizStats.map(q => ({
    quizId: q.quizId,
    title: quizTitleMap.get(q.quizId) ?? 'Unknown Quiz',
    attempts: q._count.id,
    passed: quizPassMap.get(q.quizId) ?? 0,
    rate: q._count.id > 0 ? Math.round(((quizPassMap.get(q.quizId) ?? 0) / q._count.id) * 100) : 0,
  }));

  // --- At-risk students ---
  const atRiskEnrollments = await prisma.enrollment.findMany({
    where: {
      tenantId,
      status: 'ACTIVE',
      progress: { lt: 30 },
      complianceDeadline: { not: null, lte: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) },
    },
    include: {
      course: { select: { id: true, title: true } },
    },
    orderBy: { complianceDeadline: 'asc' },
    take: 50,
  });

  // Lookup user names for at-risk enrollments
  const atRiskUserIds = [...new Set(atRiskEnrollments.map(e => e.userId))];
  const atRiskUsers = atRiskUserIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: atRiskUserIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userMap = new Map(atRiskUsers.map(u => [u.id, u]));

  const atRiskList = atRiskEnrollments
    .filter(e => {
      if (!e.complianceDeadline) return false;
      const totalDuration = e.complianceDeadline.getTime() - e.enrolledAt.getTime();
      const elapsed = now.getTime() - e.enrolledAt.getTime();
      return totalDuration > 0 && (elapsed / totalDuration) > 0.5;
    })
    .map(e => {
      const totalDuration = e.complianceDeadline!.getTime() - e.enrolledAt.getTime();
      const elapsed = now.getTime() - e.enrolledAt.getTime();
      const user = userMap.get(e.userId);
      return {
        studentId: e.userId,
        studentName: user?.name ?? user?.email ?? 'N/A',
        courseTitle: e.course.title,
        progress: Number(e.progress),
        deadline: e.complianceDeadline!.toISOString(),
        timeElapsedPct: Math.min(100, Math.round((elapsed / totalDuration) * 100)),
        enrolledAt: e.enrolledAt.toISOString(),
      };
    });

  // --- Recent activity (last 20 events) ---
  // Fetch enrollments and completions with course info
  const [recentEnrollmentRows, recentCompletionRows, recentCertificates, recentQuizRows] = await Promise.all([
    prisma.enrollment.findMany({
      where: { tenantId },
      include: {
        course: { select: { title: true } },
      },
      orderBy: { enrolledAt: 'desc' },
      take: 10,
    }),
    prisma.enrollment.findMany({
      where: { tenantId, status: 'COMPLETED', completedAt: { not: null } },
      include: {
        course: { select: { title: true } },
      },
      orderBy: { completedAt: 'desc' },
      take: 10,
    }),
    prisma.certificate.findMany({
      where: { tenantId, status: 'ISSUED' },
      select: {
        id: true,
        studentName: true,
        courseTitle: true,
        issuedAt: true,
      },
      orderBy: { issuedAt: 'desc' },
      take: 10,
    }),
    prisma.quizAttempt.findMany({
      where: { tenantId },
      include: {
        quiz: { select: { title: true } },
      },
      orderBy: { completedAt: 'desc' },
      take: 10,
    }),
  ]);

  // Gather all user IDs from recent events for batch lookup
  const eventUserIds = new Set<string>();
  recentEnrollmentRows.forEach(e => eventUserIds.add(e.userId));
  recentCompletionRows.forEach(e => eventUserIds.add(e.userId));
  recentQuizRows.forEach(q => eventUserIds.add(q.userId));

  const eventUsers = eventUserIds.size > 0
    ? await prisma.user.findMany({
        where: { id: { in: [...eventUserIds] } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const eventUserMap = new Map(eventUsers.map(u => [u.id, u]));

  const getUserName = (userId: string) => {
    const u = eventUserMap.get(userId);
    return u?.name ?? u?.email ?? 'N/A';
  };

  type ActivityEvent = {
    type: 'enrollment' | 'completion' | 'certificate' | 'quiz_pass' | 'quiz_fail';
    studentName: string;
    detail: string;
    date: string;
  };

  const events: ActivityEvent[] = [
    ...recentEnrollmentRows.map(e => ({
      type: 'enrollment' as const,
      studentName: getUserName(e.userId),
      detail: e.course.title,
      date: e.enrolledAt.toISOString(),
    })),
    ...recentCompletionRows.map(e => ({
      type: 'completion' as const,
      studentName: getUserName(e.userId),
      detail: e.course.title,
      date: (e.completedAt ?? e.updatedAt).toISOString(),
    })),
    ...recentCertificates.map(c => ({
      type: 'certificate' as const,
      studentName: c.studentName,
      detail: c.courseTitle,
      date: c.issuedAt.toISOString(),
    })),
    ...recentQuizRows.map(q => ({
      type: (q.passed ? 'quiz_pass' : 'quiz_fail') as 'quiz_pass' | 'quiz_fail',
      studentName: getUserName(q.userId),
      detail: q.quiz.title,
      date: (q.completedAt ?? new Date()).toISOString(),
    })),
  ];

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const recentActivity = events.slice(0, 20);

  return apiSuccess({
    stats: {
      totalCourses,
      totalEnrollments,
      avgCompletionRate,
      activeStudentsMonth: activeStudentsThisMonth,
      certificatesIssued: totalCertificates,
      atRiskStudents: atRiskCount,
    },
    monthlyEnrollments,
    completionByCourse,
    topCourses,
    quizPassRates,
    atRiskList,
    recentActivity,
  }, { request });
});
