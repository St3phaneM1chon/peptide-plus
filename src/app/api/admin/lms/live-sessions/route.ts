export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';

const createSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  courseId: z.string().optional(),
  instructorId: z.string().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  timezone: z.string().optional(),
  platform: z.enum(['zoom', 'teams', 'meet', 'other']).optional(),
  meetingUrl: z.string().url().optional(),
  meetingId: z.string().optional(),
  passcode: z.string().optional(),
  maxParticipants: z.number().int().min(1).optional(),
  isPublished: z.boolean().optional(),
});

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);
  const upcoming = searchParams.get('upcoming') === 'true';

  const sessions = await prisma.liveSession.findMany({
    where: {
      tenantId,
      ...(upcoming ? { startsAt: { gte: new Date() } } : {}),
    },
    orderBy: { startsAt: 'asc' },
    take: 50,
    include: { _count: { select: { attendees: true } } },
  });

  return apiSuccess(sessions, { request });
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Validation failed', ErrorCode.VALIDATION_ERROR, { request });
  }

  const startsAtDate = new Date(parsed.data.startsAt);
  const endsAtDate = new Date(parsed.data.endsAt);
  if (endsAtDate <= startsAtDate) {
    return apiError('End time must be after start time', ErrorCode.VALIDATION_ERROR, { request, status: 400 });
  }

  const liveSession = await prisma.liveSession.create({
    data: {
      tenantId,
      ...parsed.data,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
    },
  });

  return apiSuccess(liveSession, { request, status: 201 });
});

export const DELETE = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return apiError('Session ID required', ErrorCode.VALIDATION_ERROR, { request, status: 400 });

  const liveSession = await prisma.liveSession.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!liveSession) return apiError('Session not found', ErrorCode.NOT_FOUND, { request, status: 404 });

  await prisma.liveSession.update({ where: { id }, data: { isPublished: false } });
  return apiSuccess({ success: true }, { request });
});
