export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';

const createBankSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  domain: z.string().max(100).optional(),
});

const addQuestionSchema = z.object({
  bankId: z.string().min(1),
  type: z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_IN', 'MATCHING', 'ORDERING']).optional(),
  question: z.string().min(1),
  explanation: z.string().optional(),
  points: z.number().int().min(1).max(10).optional(),
  bloomLevel: z.number().int().min(1).max(5).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  // FIX P2: Validate options structure instead of z.any()
  options: z.array(z.object({
    id: z.string().optional(),
    text: z.string(),
    isCorrect: z.boolean().optional(),
  })).optional(),
  correctAnswer: z.string().optional(),
  tags: z.array(z.string()).optional(),
  conceptId: z.string().optional(),
});

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') ?? undefined;
  const category = searchParams.get('category') ?? undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { tenantId, isActive: true };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (category) where.category = category;

  const banks = await prisma.questionBank.findMany({
    where,
    include: { _count: { select: { questions: true } } },
    orderBy: { name: 'asc' },
    take: 50,
  });

  return apiSuccess(banks, { request });
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();

  // Add question to existing bank
  if (body.bankId) {
    const parsed = addQuestionSchema.safeParse(body);
    if (!parsed.success) return apiError('Validation failed', ErrorCode.VALIDATION_ERROR, { request });

    const question = await prisma.questionBankItem.create({
      data: {
        bankId: parsed.data.bankId,
        type: parsed.data.type ?? 'MULTIPLE_CHOICE',
        question: parsed.data.question,
        explanation: parsed.data.explanation ?? null,
        points: parsed.data.points ?? 1,
        bloomLevel: parsed.data.bloomLevel ?? 2,
        difficulty: parsed.data.difficulty ?? 'medium',
        options: parsed.data.options ?? [],
        correctAnswer: parsed.data.correctAnswer ?? null,
        tags: parsed.data.tags ?? [],
        conceptId: parsed.data.conceptId ?? null,
      },
    });

    return apiSuccess(question, { request, status: 201 });
  }

  // Create new bank
  const parsed = createBankSchema.safeParse(body);
  if (!parsed.success) return apiError('Validation failed', ErrorCode.VALIDATION_ERROR, { request });

  const bank = await prisma.questionBank.create({
    data: {
      tenantId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      domain: parsed.data.domain ?? null,
    },
  });

  return apiSuccess(bank, { request, status: 201 });
});

const updateBankSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  domain: z.string().max(100).optional(),
});

export const PATCH = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return apiError('Bank ID required', ErrorCode.VALIDATION_ERROR, { request, status: 400 });

  const body = await request.json();
  const parsed = updateBankSchema.safeParse(body);
  if (!parsed.success) return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, { request, status: 400 });

  const existing = await prisma.questionBank.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) return apiError('Bank not found', ErrorCode.NOT_FOUND, { request, status: 404 });

  const updated = await prisma.questionBank.update({ where: { id }, data: parsed.data });
  return apiSuccess(updated, { request });
});

export const PUT = PATCH;

export const DELETE = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return apiError('Bank ID required', ErrorCode.VALIDATION_ERROR, { request, status: 400 });

  const bank = await prisma.questionBank.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!bank) return apiError('Bank not found', ErrorCode.NOT_FOUND, { request, status: 404 });

  await prisma.questionBank.update({ where: { id }, data: { isActive: false } });
  return apiSuccess({ success: true }, { request });
});
