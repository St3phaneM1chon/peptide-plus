export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  maxScore: z.number().int().min(1).max(1000).optional(),
  criteria: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    weight: z.number().min(0).max(100).optional(),
    levels: z.array(z.object({
      score: z.number(),
      label: z.string(),
      description: z.string().optional(),
    })),
  })).min(1),
});

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const rubrics = await prisma.gradingRubric.findMany({
    where: { tenantId, isActive: true },
    orderBy: { name: 'asc' },
  });
  return apiSuccess(rubrics, { request });
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) return apiError('Validation failed', ErrorCode.VALIDATION_ERROR, { request });

  const rubric = await prisma.gradingRubric.create({
    data: {
      tenantId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      maxScore: parsed.data.maxScore ?? 100,
      criteria: parsed.data.criteria,
    },
  });

  return apiSuccess(rubric, { request, status: 201 });
});
