export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId');

  if (!courseId) {
    return apiError('courseId required', ErrorCode.VALIDATION_ERROR, { request });
  }

  // Get or compute gradebook entries for all enrolled students
  const enrollments = await prisma.enrollment.findMany({
    where: { tenantId, courseId },
    include: {
      lessonProgress: {
        select: { quizScore: true, quizPassed: true, isCompleted: true },
      },
      course: { select: { passingScore: true, examQuizId: true } },
    },
  });

  // --- Batch-fetch data to avoid N+1 per-enrollment DB calls ---
  const userIds = enrollments.map(e => e.userId);

  // Collect all unique examQuizIds from enrollments
  const examQuizIds = [...new Set(
    enrollments.map(e => e.course.examQuizId).filter((id): id is string => id !== null)
  )];

  // Batch: all passing quiz attempts for exam quizzes
  const allExamAttempts = examQuizIds.length > 0
    ? await prisma.quizAttempt.findMany({
        where: { tenantId, userId: { in: userIds }, quizId: { in: examQuizIds }, passed: true },
        select: { userId: true, quizId: true, score: true },
        orderBy: { score: 'desc' },
      })
    : [];
  // Map: `${userId}:${quizId}` → best score (first match since ordered desc)
  const examScoreMap = new Map<string, number>();
  for (const attempt of allExamAttempts) {
    const key = `${attempt.userId}:${attempt.quizId}`;
    if (!examScoreMap.has(key)) {
      examScoreMap.set(key, Number(attempt.score));
    }
  }

  // Batch: discussion counts grouped by userId
  const discussionGroups = await prisma.courseDiscussion.groupBy({
    by: ['userId'],
    where: { tenantId, courseId, userId: { in: userIds } },
    _count: true,
  });
  const discussionCountMap = new Map<string, number>(
    discussionGroups.map(g => [g.userId, g._count])
  );

  // Batch: QA counts grouped by userId
  const qaGroups = await prisma.lessonQA.groupBy({
    by: ['userId'],
    where: { tenantId, userId: { in: userIds } },
    _count: true,
  });
  const qaCountMap = new Map<string, number>(
    qaGroups.map(g => [g.userId, g._count])
  );

  const grades = await Promise.all(enrollments.map(async (enrollment) => {
    // Quiz average
    const quizScores = enrollment.lessonProgress
      .filter(p => p.quizScore !== null)
      .map(p => Number(p.quizScore));
    const quizAverage = quizScores.length > 0
      ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length
      : null;

    // Exam score (from batch map)
    let examScore: number | null = null;
    if (enrollment.course.examQuizId) {
      examScore = examScoreMap.get(`${enrollment.userId}:${enrollment.course.examQuizId}`) ?? null;
    }

    // Participation score (from batch maps)
    const discussionCount = discussionCountMap.get(enrollment.userId) ?? 0;
    const qaCount = qaCountMap.get(enrollment.userId) ?? 0;
    const participationScore = Math.min(100, (discussionCount + qaCount) * 10);

    // Weighted final grade (30% quiz, 40% exam, 20% assignments, 10% participation)
    const weights = { quiz: 30, exam: 40, assignment: 20, participation: 10 };
    let finalGrade: number | null = null;
    if (quizAverage !== null || examScore !== null) {
      finalGrade = 0;
      let totalWeight = 0;
      if (quizAverage !== null) { finalGrade += quizAverage * weights.quiz; totalWeight += weights.quiz; }
      if (examScore !== null) { finalGrade += examScore * weights.exam; totalWeight += weights.exam; }
      finalGrade += participationScore * weights.participation;
      totalWeight += weights.participation;
      finalGrade = totalWeight > 0 ? finalGrade / totalWeight : null;
    }

    const letterGrade = finalGrade !== null ? getLetterGrade(finalGrade) : null;

    // Upsert gradebook
    await prisma.gradebook.upsert({
      where: { tenantId_courseId_userId: { tenantId, courseId, userId: enrollment.userId } },
      create: {
        tenantId, courseId, userId: enrollment.userId,
        quizAverage, examScore, participationScore,
        finalGrade, letterGrade,
        passed: (finalGrade ?? 0) >= (enrollment.course.passingScore ?? 70),
        lastCalculatedAt: new Date(),
      },
      update: {
        quizAverage, examScore, participationScore,
        finalGrade, letterGrade,
        passed: (finalGrade ?? 0) >= (enrollment.course.passingScore ?? 70),
        lastCalculatedAt: new Date(),
      },
    });

    return {
      userId: enrollment.userId,
      enrollmentId: enrollment.id,
      progress: Number(enrollment.progress),
      status: enrollment.status,
      quizAverage,
      examScore,
      participationScore,
      finalGrade: finalGrade !== null ? Math.round(finalGrade * 10) / 10 : null,
      letterGrade,
      passed: (finalGrade ?? 0) >= (enrollment.course.passingScore ?? 70),
    };
  }));

  return apiSuccess({ courseId, grades, count: grades.length }, { request });
});

function getLetterGrade(score: number): string {
  if (score >= 93) return 'A+';
  if (score >= 86) return 'A';
  if (score >= 80) return 'B+';
  if (score >= 73) return 'B';
  if (score >= 67) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}
