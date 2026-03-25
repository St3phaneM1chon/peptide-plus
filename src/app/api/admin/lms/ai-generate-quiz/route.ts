export const dynamic = 'force-dynamic';

/**
 * AI Quiz Generation API
 * POST /api/admin/lms/ai-generate-quiz — Generate quiz questions from lesson content
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';
import { generateQuizQuestions } from '@/lib/lms/ai-quiz-generator';

const generateSchema = z.object({
  lessonId: z.string().min(1),
  questionCount: z.number().int().min(1).max(20).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).optional(),
  types: z.array(z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_IN'])).optional(),
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();
  const parsed = generateSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input: ' + parsed.error.errors.map(e => e.message).join(', '), ErrorCode.VALIDATION_ERROR, { request });
  }

  const { lessonId, questionCount, difficulty, types } = parsed.data;

  // Fetch lesson content
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, tenantId },
    select: { title: true, textContent: true, manualText: true, description: true },
  });

  if (!lesson) {
    return apiError('Lesson not found', ErrorCode.NOT_FOUND, { request, status: 404 });
  }

  const content = lesson.manualText || lesson.textContent || lesson.description;
  if (!content || content.length < 50) {
    return apiError('Lesson has insufficient content for quiz generation', ErrorCode.VALIDATION_ERROR, { request });
  }

  const questions = await generateQuizQuestions({
    lessonTitle: lesson.title,
    content,
    questionCount,
    difficulty,
    types,
    language: 'fr',
  });

  return apiSuccess({ questions, lessonTitle: lesson.title, count: questions.length }, { request });
});
