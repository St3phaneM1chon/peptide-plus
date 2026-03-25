export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';

const createSchema = z.object({
  courseId: z.string().min(1),
  chapterId: z.string().min(1),
  unlockType: z.enum(['delay', 'date']),
  delayDays: z.number().int().min(0).optional(),
  unlockDate: z.string().datetime().optional(),
});

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId');

  if (!courseId) return apiError('courseId required', ErrorCode.VALIDATION_ERROR, { request });

  const schedules = await prisma.dripSchedule.findMany({
    where: { tenantId, courseId, isActive: true },
    orderBy: { delayDays: 'asc' },
  });

  return apiSuccess(schedules, { request });
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) return apiError('Validation failed', ErrorCode.VALIDATION_ERROR, { request });

  const schedule = await prisma.dripSchedule.upsert({
    where: { tenantId_courseId_chapterId: { tenantId, courseId: parsed.data.courseId, chapterId: parsed.data.chapterId } },
    create: {
      tenantId,
      courseId: parsed.data.courseId,
      chapterId: parsed.data.chapterId,
      unlockType: parsed.data.unlockType,
      delayDays: parsed.data.delayDays ?? null,
      unlockDate: parsed.data.unlockDate ? new Date(parsed.data.unlockDate) : null,
    },
    update: {
      unlockType: parsed.data.unlockType,
      delayDays: parsed.data.delayDays ?? null,
      unlockDate: parsed.data.unlockDate ? new Date(parsed.data.unlockDate) : null,
    },
  });

  return apiSuccess(schedule, { request, status: 201 });
});
