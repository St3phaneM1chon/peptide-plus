export const dynamic = 'force-dynamic';

/**
 * Admin Challenges API
 * GET  /api/admin/lms/challenges — List all challenges
 * POST /api/admin/lms/challenges — Create challenge + auto-enroll active students
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';

const createSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(1000).optional(),
  criteria: z.object({
    action: z.enum(['lesson_complete', 'quiz_pass', 'course_complete', 'daily_login']),
    count: z.number().int().min(1).max(100),
  }),
  type: z.enum(['weekly', 'monthly', 'one_time', 'daily']).default('weekly'),
  xpReward: z.number().int().min(1).max(1000), // P7-08: capped at 1000
  badgeId: z.string().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  autoEnroll: z.boolean().default(true),
});

export const GET = withAdminGuard(async (_request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;

  const challenges = await prisma.lmsChallenge.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      _count: { select: { participants: true } },
    },
  });

  return apiSuccess(challenges, { request: _request });
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Invalid input: ' + parsed.error.errors.map(e => e.message).join(', '), ErrorCode.VALIDATION_ERROR, { request, status: 400 });
  }

  const { autoEnroll, ...data } = parsed.data;

  // Validate date range
  if (new Date(data.endsAt) <= new Date(data.startsAt)) {
    return apiError('End date must be after start date', ErrorCode.VALIDATION_ERROR, { request, status: 400 });
  }

  // Validate badgeId belongs to tenant
  if (data.badgeId) {
    const badge = await prisma.lmsBadge.findFirst({
      where: { id: data.badgeId, tenantId },
      select: { id: true },
    });
    if (!badge) {
      return apiError('Badge not found', ErrorCode.NOT_FOUND, { request, status: 404 });
    }
  }

  const challenge = await prisma.lmsChallenge.create({
    data: {
      tenantId,
      title: data.title,
      description: data.description ?? '',
      type: data.type,
      criteria: data.criteria,
      xpReward: data.xpReward,
      badgeId: data.badgeId ?? null,
      startsAt: new Date(data.startsAt),
      endsAt: new Date(data.endsAt),
      isActive: true,
    },
  });

  // P7-13 FIX: Auto-enroll active students with enrollments
  let enrolled = 0;
  if (autoEnroll) {
    const activeStudents = await prisma.enrollment.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: { userId: true },
      distinct: ['userId'],
      take: 1000,
    });

    if (activeStudents.length > 0) {
      const result = await prisma.lmsChallengeParticipant.createMany({
        data: activeStudents.map(s => ({
          tenantId,
          challengeId: challenge.id,
          userId: s.userId,
          progress: 0,
        })),
        skipDuplicates: true,
      });
      enrolled = result.count;
    }
  }

  return apiSuccess({ challenge, enrolledStudents: enrolled }, { request, status: 201 });
});
