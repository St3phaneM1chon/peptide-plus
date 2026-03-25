export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';

const updateQuizSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  timeLimit: z.number().int().min(1).optional().nullable(),
  maxAttempts: z.number().int().min(1).max(100).optional(),
  passingScore: z.number().int().min(0).max(100).optional(),
  shuffleQuestions: z.boolean().optional(),
  showResults: z.boolean().optional(),
  questions: z.array(z.object({
    id: z.string().optional(),
    type: z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_IN', 'MATCHING', 'ORDERING']).optional(),
    question: z.string().min(1),
    explanation: z.string().optional().nullable(),
    points: z.number().int().min(1).optional(),
    sortOrder: z.number().int().min(0).optional(),
    options: z.array(z.object({
      id: z.string(),
      text: z.string(),
      isCorrect: z.boolean(),
    })).optional(),
    correctAnswer: z.string().optional().nullable(),
    caseSensitive: z.boolean().optional(),
    matchingPairs: z.array(z.object({
      left: z.string(),
      right: z.string(),
    })).optional().nullable(),
  })).optional(),
});

export const GET = withAdminGuard(async (request: NextRequest, { session, params }) => {
  const tenantId = session.user.tenantId;
  const { id } = await params;

  const quiz = await prisma.quiz.findFirst({
    where: { id, tenantId },
    include: {
      questions: { orderBy: { sortOrder: 'asc' } },
      lesson: { select: { id: true, title: true, chapter: { select: { course: { select: { id: true, title: true } } } } } },
      _count: { select: { attempts: true } },
    },
  });

  if (!quiz) {
    return apiError('Quiz not found', ErrorCode.NOT_FOUND, { request, status: 404 });
  }

  return apiSuccess(quiz, { request });
});

export const PUT = withAdminGuard(async (request: NextRequest, { session, params }) => {
  const tenantId = session.user.tenantId;
  const { id } = await params;
  const body = await request.json();
  const parsed = updateQuizSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Validation failed', ErrorCode.VALIDATION_ERROR, { request });
  }

  const existing = await prisma.quiz.findFirst({ where: { id, tenantId } });
  if (!existing) {
    return apiError('Quiz not found', ErrorCode.NOT_FOUND, { request, status: 404 });
  }

  const { questions, ...quizData } = parsed.data;

  const quiz = await prisma.$transaction(async (tx) => {
    // Update quiz metadata
    await tx.quiz.update({
      where: { id },
      data: {
        ...quizData,
        updatedAt: new Date(),
      },
    });

    // If questions provided, replace all questions (delete + create)
    if (questions) {
      await tx.quizQuestion.deleteMany({ where: { quizId: id } });
      if (questions.length > 0) {
        await tx.quizQuestion.createMany({
          data: questions.map((q, i) => ({
            quizId: id,
            type: q.type ?? 'MULTIPLE_CHOICE',
            question: q.question,
            explanation: q.explanation ?? null,
            points: q.points ?? 1,
            sortOrder: q.sortOrder ?? i,
            options: q.options ?? [],
            correctAnswer: q.correctAnswer ?? null,
            caseSensitive: q.caseSensitive ?? false,
            matchingPairs: q.matchingPairs ?? undefined,
          })),
        });
      }
    }

    return tx.quiz.findUnique({
      where: { id },
      include: { questions: { orderBy: { sortOrder: 'asc' } } },
    });
  });

  return apiSuccess(quiz, { request });
});

export const DELETE = withAdminGuard(async (request: NextRequest, { session, params }) => {
  const tenantId = session.user.tenantId;
  const { id } = await params;

  const existing = await prisma.quiz.findFirst({ where: { id, tenantId } });
  if (!existing) {
    return apiError('Quiz not found', ErrorCode.NOT_FOUND, { request, status: 404 });
  }

  // P9-12 FIX: Prevent deleting quizzes with existing student attempts
  const attemptCount = await prisma.quizAttempt.count({ where: { quizId: id, tenantId } });
  if (attemptCount > 0) {
    return apiError('Cannot delete quiz with existing attempts. Archive it instead.', ErrorCode.VALIDATION_ERROR, { request, status: 400 });
  }

  await prisma.quiz.delete({ where: { id } });

  return apiSuccess({ deleted: true }, { request });
});
