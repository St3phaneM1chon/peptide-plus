export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';

const createSchema = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().min(1),
  title: z.string().min(1).max(300),
  instructions: z.string().max(5000).optional(),
  rubricId: z.string().optional(),
  maxReviewers: z.number().int().min(1).max(10).optional(),
  isAnonymous: z.boolean().optional(),
  deadline: z.string().datetime().optional(),
});

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId');

  const assignments = await prisma.peerReviewAssignment.findMany({
    where: { tenantId, ...(courseId ? { courseId } : {}), isActive: true },
    include: {
      _count: { select: { submissions: true } },
      rubric: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return apiSuccess(assignments, { request });
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) return apiError(parsed.error.message, ErrorCode.VALIDATION_ERROR, { request });

  const assignment = await prisma.peerReviewAssignment.create({
    data: {
      tenantId,
      ...parsed.data,
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
    },
  });

  return apiSuccess(assignment, { request, status: 201 });
});
