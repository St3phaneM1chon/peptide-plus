export const dynamic = 'force-dynamic';

/**
 * Exam Gate API
 * GET  /api/lms/exam/[courseId] — Check if student can access the final exam
 * POST /api/lms/exam/[courseId] — Submit exam attempt
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { canAccessExam, submitQuizAttempt } from '@/lib/lms/lms-service';
import { withUserGuard } from '@/lib/user-api-guard';

const examSubmitSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string(),
    answer: z.union([z.string(), z.array(z.string())]),
  })).min(1),
});

// Helper: extract courseId from URL path
function extractCourseId(url: string): string | null {
  const match = url.match(/\/api\/lms\/exam\/([^/?]+)/);
  return match?.[1] ?? null;
}

export const GET = withUserGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 403 });

  const courseId = extractCourseId(request.url);
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 });

  const userId = session.user.id;

  const enrollment = await prisma.enrollment.findUnique({
    where: { tenantId_courseId_userId: { tenantId, courseId, userId } },
    include: { course: { select: { examQuizId: true, title: true, passingScore: true } } },
  });

  if (!enrollment) {
    return NextResponse.json({ error: 'Not enrolled in this course' }, { status: 403 });
  }

  if (!enrollment.course.examQuizId) {
    return NextResponse.json({ error: 'This course has no final exam configured' }, { status: 404 });
  }

  const examStatus = await canAccessExam(tenantId, enrollment.id);

  const attempts = await prisma.quizAttempt.findMany({
    where: { tenantId, quizId: enrollment.course.examQuizId, userId },
    orderBy: { completedAt: 'desc' },
    take: 5,
    select: { id: true, score: true, passed: true, completedAt: true, timeTaken: true },
  });

  return NextResponse.json({
    data: {
      courseTitle: enrollment.course.title,
      examQuizId: enrollment.course.examQuizId,
      passingScore: enrollment.course.passingScore,
      ...examStatus,
      previousAttempts: attempts,
      bestScore: attempts.length > 0 ? Math.max(...attempts.map(a => Number(a.score ?? 0))) : null,
      hasPassed: attempts.some(a => a.passed),
    },
  });
}, { skipCsrf: true });

export const POST = withUserGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 403 });

  const courseId = extractCourseId(request.url);
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 });

  const userId = session.user.id;

  const enrollment = await prisma.enrollment.findUnique({
    where: { tenantId_courseId_userId: { tenantId, courseId, userId } },
    include: { course: { select: { examQuizId: true } } },
  });

  if (!enrollment) return NextResponse.json({ error: 'Not enrolled' }, { status: 403 });
  if (!enrollment.course.examQuizId) return NextResponse.json({ error: 'No exam configured' }, { status: 404 });

  const examStatus = await canAccessExam(tenantId, enrollment.id);
  if (!examStatus.allowed) {
    return NextResponse.json({
      error: 'Exam locked — complete all lessons first',
      progress: examStatus.progress,
      missingLessons: examStatus.missingLessons,
    }, { status: 403 });
  }

  const body = await request.json();
  const parsed = examSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid answers format' }, { status: 400 });
  }
  const result = await submitQuizAttempt(tenantId, enrollment.course.examQuizId, userId, parsed.data.answers);

  return NextResponse.json({ data: result });
});
