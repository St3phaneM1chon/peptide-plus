export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';

const createSchema = z.object({
  courseId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  maxMembers: z.number().int().min(1).optional(),
  memberUserIds: z.array(z.string()).optional(),
});

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId');

  const cohorts = await prisma.lmsCohort.findMany({
    where: { tenantId, ...(courseId ? { courseId } : {}), isActive: true },
    include: { _count: { select: { members: true } } },
    orderBy: { startsAt: 'desc' },
  });

  return apiSuccess(cohorts, { request });
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) return apiError('Validation failed', ErrorCode.VALIDATION_ERROR, { request });

  const { memberUserIds, ...cohortData } = parsed.data;

  const cohort = await prisma.lmsCohort.create({
    data: {
      tenantId,
      ...cohortData,
      startsAt: new Date(cohortData.startsAt),
      endsAt: cohortData.endsAt ? new Date(cohortData.endsAt) : null,
      ...(memberUserIds?.length ? {
        members: {
          create: memberUserIds.map(userId => ({ tenantId, userId })),
        },
      } : {}),
    },
    include: { _count: { select: { members: true } } },
  });

  return apiSuccess(cohort, { request, status: 201 });
});
