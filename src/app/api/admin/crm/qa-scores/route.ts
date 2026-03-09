export const dynamic = 'force-dynamic';

/**
 * CRM QA Scores API
 * GET  /api/admin/crm/qa-scores - List QA scores with filters (formId, agentId, date range)
 * POST /api/admin/crm/qa-scores - Create a QA score with auto-calculated totals
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, apiPaginated } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createScoreSchema = z.object({
  formId: z.string().min(1, 'Form ID is required'),
  agentId: z.string().min(1, 'Agent ID is required'),
  callLogId: z.string().optional().nullable(),
  scores: z.record(z.string(), z.number().min(0).max(100)), // { criterionName: score }
  feedback: z.string().max(5000).optional().nullable(),
});

// ---------------------------------------------------------------------------
// GET: List QA scores with filters
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  // Filters
  const formId = searchParams.get('formId');
  const agentId = searchParams.get('agentId');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (formId) {
    where.formId = formId;
  }

  if (agentId) {
    where.agentId = agentId;
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) {
      where.createdAt.gte = new Date(dateFrom);
    }
    if (dateTo) {
      where.createdAt.lte = new Date(dateTo);
    }
  }

  const [scores, total] = await Promise.all([
    prisma.crmQaScore.findMany({
      where,
      include: {
        form: {
          select: { id: true, name: true, criteria: true },
        },
        agent: {
          select: { id: true, name: true, email: true, image: true },
        },
        scoredBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.crmQaScore.count({ where }),
  ]);

  return apiPaginated(scores, page, limit, total, { request });
}, { requiredPermission: 'crm.settings' });

// ---------------------------------------------------------------------------
// POST: Create a QA score
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const body = await request.json();
  const parsed = createScoreSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
      status: 400,
      details: parsed.error.flatten(),
      request,
    });
  }

  const { formId, agentId, callLogId, scores, feedback } = parsed.data;

  // Verify form exists and get criteria
  const form = await prisma.crmQaForm.findUnique({
    where: { id: formId },
    select: { id: true, name: true, criteria: true, isActive: true },
  });

  if (!form) {
    return apiError('QA form not found', ErrorCode.RESOURCE_NOT_FOUND, {
      status: 404,
      request,
    });
  }

  if (!form.isActive) {
    return apiError('QA form is inactive', ErrorCode.VALIDATION_ERROR, {
      status: 400,
      request,
    });
  }

  // Verify agent exists
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    select: { id: true },
  });

  if (!agent) {
    return apiError('Agent not found', ErrorCode.RESOURCE_NOT_FOUND, {
      status: 404,
      request,
    });
  }

  // Auto-calculate totalScore, maxScore, percentage from form criteria
  const criteria = form.criteria as Array<{ name: string; maxScore: number; weight: number }>;

  let totalScore = 0;
  let maxScore = 0;

  for (const criterion of criteria) {
    const score = scores[criterion.name] ?? 0;
    totalScore += score * criterion.weight;
    maxScore += criterion.maxScore * criterion.weight;
  }

  const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

  const qaScore = await prisma.crmQaScore.create({
    data: {
      formId,
      agentId,
      scoredById: session.user.id,
      callLogId: callLogId ?? null,
      scores: JSON.parse(JSON.stringify(scores)),
      totalScore,
      maxScore,
      percentage: Math.round(percentage * 100) / 100,
      feedback: feedback ?? null,
    },
    include: {
      form: {
        select: { id: true, name: true, criteria: true },
      },
      agent: {
        select: { id: true, name: true, email: true, image: true },
      },
      scoredBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  logger.info('CRM QA score created', {
    event: 'crm_qa_score_created',
    scoreId: qaScore.id,
    formId,
    agentId,
    totalScore,
    maxScore,
    percentage: Math.round(percentage * 100) / 100,
    userId: session.user.id,
  });

  return apiSuccess(qaScore, { status: 201, request });
}, { requiredPermission: 'crm.settings' });
