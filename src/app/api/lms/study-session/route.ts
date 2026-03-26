export const dynamic = 'force-dynamic';

/**
 * Study Session Tracking API
 * POST /api/lms/study-session — Record study time via xAPI statement
 *
 * Used by the StudyTimer component to persist session duration.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withUserGuard } from '@/lib/user-api-guard';
import { prisma } from '@/lib/db';

const sessionSchema = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().min(1).optional(),
  durationSeconds: z.number().int().min(1).max(28800), // Max 8 hours
});

export const POST = withUserGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

  const body = await request.json();
  const parsed = sessionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const userId = session.user.id!;
  const { courseId, lessonId, durationSeconds } = parsed.data;

  // Record as xAPI statement
  await prisma.xapiStatement.create({
    data: {
      tenantId,
      actorId: userId,
      verb: 'experienced',
      objectType: lessonId ? 'lesson' : 'course',
      objectId: lessonId ?? courseId,
      result: { duration: durationSeconds, completion: false },
      context: { courseId },
    },
  });

  // Update enrollment lastAccessedAt
  await prisma.enrollment.updateMany({
    where: { tenantId, courseId, userId },
    data: { lastAccessedAt: new Date() },
  }).catch(() => {});

  return NextResponse.json({ success: true, durationSeconds });
});
