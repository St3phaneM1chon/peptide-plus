export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  description: z.string().max(5000).optional(),
  roleType: z.string().min(1),
  level: z.enum(['entry', 'intermediate', 'senior', 'specialist']).optional(),
  steps: z.array(z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    courseId: z.string().optional(),
    bundleId: z.string().optional(),
    isRequired: z.boolean().optional(),
  })).min(1),
});

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;

  const paths = await prisma.lmsRolePath.findMany({
    where: { tenantId, isActive: true },
    include: {
      steps: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { steps: true } },
    },
    orderBy: { name: 'asc' },
  });

  return apiSuccess(paths, { request });
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Validation failed', ErrorCode.VALIDATION_ERROR, { request });
  }

  const { steps, ...pathData } = parsed.data;

  const path = await prisma.lmsRolePath.create({
    data: {
      tenantId,
      ...pathData,
      steps: {
        create: steps.map((step, i) => ({
          ...step,
          sortOrder: i,
        })),
      },
    },
    include: { steps: { orderBy: { sortOrder: 'asc' } } },
  });

  return apiSuccess(path, { request, status: 201 });
});
