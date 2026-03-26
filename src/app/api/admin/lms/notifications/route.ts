export const dynamic = 'force-dynamic';

/**
 * Admin Notifications API
 * GET  /api/admin/lms/notifications — Recent notifications sent
 * POST /api/admin/lms/notifications — Send announcement to students
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';

const announcementSchema = z.object({
  title: z.string().min(3).max(200),
  message: z.string().min(1).max(2000),
  link: z.string().url().optional(),
  targetCourseId: z.string().optional(), // Send to all students enrolled in a specific course
  targetAll: z.boolean().default(false), // Send to all students in tenant
});

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;

  const notifications = await prisma.lmsNotification.findMany({
    where: { tenantId, type: 'announcement' },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return apiSuccess(notifications, { request });
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();
  const parsed = announcementSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, { request, status: 400 });
  }

  const { title, message, link, targetCourseId, targetAll } = parsed.data;

  // Determine target user IDs
  let targetUserIds: string[] = [];

  if (targetCourseId) {
    const enrollments = await prisma.enrollment.findMany({
      where: { tenantId, courseId: targetCourseId, status: { in: ['ACTIVE', 'COMPLETED'] } },
      select: { userId: true },
      distinct: ['userId'],
    });
    targetUserIds = enrollments.map(e => e.userId);
  } else if (targetAll) {
    const enrollments = await prisma.enrollment.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: { userId: true },
      distinct: ['userId'],
      take: 10000,
    });
    targetUserIds = enrollments.map(e => e.userId);
  }

  if (targetUserIds.length === 0) {
    return apiError('No target students found', ErrorCode.VALIDATION_ERROR, { request, status: 400 });
  }

  // Batch create notifications
  const result = await prisma.lmsNotification.createMany({
    data: targetUserIds.map(userId => ({
      tenantId,
      userId,
      type: 'announcement',
      title,
      message,
      link: link ?? null,
    })),
  });

  return apiSuccess({ sent: result.count, targetCount: targetUserIds.length }, { request, status: 201 });
});
