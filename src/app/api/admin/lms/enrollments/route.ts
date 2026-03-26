export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';
import { enrollUser } from '@/lib/lms/lms-service';

const enrollSchema = z.object({
  courseId: z.string().min(1),
  userId: z.string().min(1),
});

const bulkEnrollSchema = z.object({
  courseId: z.string().min(1),
  userIds: z.array(z.string().min(1)).min(1).max(500),
});

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId') ?? undefined;
  const status = searchParams.get('status') as 'ACTIVE' | 'COMPLETED' | 'SUSPENDED' | undefined;
  const complianceStatus = searchParams.get('complianceStatus') as 'OVERDUE' | 'NOT_STARTED' | undefined;
  const search = searchParams.get('search') ?? undefined;
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);

  // If search is provided, find matching userIds first
  let searchUserIds: string[] | undefined;
  if (search) {
    const matchingUsers = await prisma.user.findMany({
      where: { tenantId, OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] },
      select: { id: true },
      take: 200,
    });
    searchUserIds = matchingUsers.map(u => u.id);
    if (searchUserIds.length === 0) {
      return apiSuccess({ enrollments: [], total: 0, page, limit, totalPages: 0 }, { request });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    tenantId,
    ...(courseId && { courseId }),
    ...(status && { status }),
    ...(complianceStatus && { complianceStatus }),
    ...(searchUserIds && { userId: { in: searchUserIds } }),
  };

  const [enrollments, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      include: { course: { select: { id: true, title: true, slug: true } } },
      orderBy: { enrolledAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.enrollment.count({ where }),
  ]);

  // Resolve user names for the response
  const userIds = [...new Set(enrollments.map(e => e.userId))];
  const users = userIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: userIds }, tenantId }, select: { id: true, name: true, email: true } })
    : [];
  const userMap = new Map(users.map(u => [u.id, u]));

  const enriched = enrollments.map(e => ({
    ...e,
    userName: userMap.get(e.userId)?.name ?? 'N/A',
    userEmail: userMap.get(e.userId)?.email ?? 'N/A',
  }));

  return apiSuccess({ enrollments: enriched, total, page, limit, totalPages: Math.ceil(total / limit) }, { request });
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();

  // Bulk enrollment
  if (body.userIds) {
    const parsed = bulkEnrollSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Validation failed', ErrorCode.VALIDATION_ERROR, { request });
    }

    const results = await Promise.allSettled(
      parsed.data.userIds.map(userId =>
        enrollUser(tenantId, parsed.data.courseId, userId, session.user.id)
      )
    );

    const enrolled = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    return apiSuccess({ enrolled, failed, total: parsed.data.userIds.length }, { request, status: 201 });
  }

  const parsed = enrollSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Validation failed', ErrorCode.VALIDATION_ERROR, { request });
  }

  try {
    const enrollment = await enrollUser(tenantId, parsed.data.courseId, parsed.data.userId, session.user.id);
    return apiSuccess(enrollment, { request, status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return apiError(error.message, ErrorCode.VALIDATION_ERROR, { request });
    }
    throw error;
  }
});
