export const dynamic = 'force-dynamic';

/**
 * Student Challenges API
 * GET  /api/lms/challenges — List active challenges + my participation
 * POST /api/lms/challenges — Join a challenge
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withUserGuard } from '@/lib/user-api-guard';
import { prisma } from '@/lib/db';

export const GET = withUserGuard(async (_request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

  const now = new Date();
  const userId = session.user.id!;

  // Get active challenges
  const challenges = await prisma.lmsChallenge.findMany({
    where: {
      tenantId,
      isActive: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    orderBy: { endsAt: 'asc' },
    take: 20,
  });

  // Get my participations
  const participations = await prisma.lmsChallengeParticipant.findMany({
    where: { tenantId, userId, challengeId: { in: challenges.map(c => c.id) } },
    select: { challengeId: true, progress: true, isCompleted: true, completedAt: true },
  });
  const participationMap = new Map(participations.map(p => [p.challengeId, p]));

  const data = challenges.map(c => {
    const criteria = c.criteria as { action?: string; count?: number } | null;
    const participation = participationMap.get(c.id);
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      type: c.type,
      xpReward: c.xpReward,
      targetCount: criteria?.count ?? 1,
      action: criteria?.action ?? 'unknown',
      endsAt: c.endsAt,
      joined: !!participation,
      progress: participation?.progress ?? 0,
      isCompleted: participation?.isCompleted ?? false,
      completedAt: participation?.completedAt ?? null,
    };
  });

  return NextResponse.json({ data });
}, { skipCsrf: true });

const joinSchema = z.object({
  challengeId: z.string().min(1),
});

export const POST = withUserGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

  const body = await request.json();
  const parsed = joinSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const userId = session.user.id!;

  // Verify challenge exists and is active
  const challenge = await prisma.lmsChallenge.findFirst({
    where: { id: parsed.data.challengeId, tenantId, isActive: true },
    select: { id: true, endsAt: true },
  });
  if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
  if (challenge.endsAt < new Date()) return NextResponse.json({ error: 'Challenge has ended' }, { status: 400 });

  // Check if already joined
  const existing = await prisma.lmsChallengeParticipant.findFirst({
    where: { challengeId: parsed.data.challengeId, userId },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ error: 'Already joined' }, { status: 409 });

  const participant = await prisma.lmsChallengeParticipant.create({
    data: {
      tenantId,
      challengeId: parsed.data.challengeId,
      userId,
    },
  });

  return NextResponse.json({ data: participant }, { status: 201 });
});
