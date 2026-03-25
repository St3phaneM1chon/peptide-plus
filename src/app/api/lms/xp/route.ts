export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withUserGuard } from '@/lib/user-api-guard';
import { prisma } from '@/lib/db';
import { getXpSummary } from '@/lib/lms/xp-service';

export const GET = withUserGuard(async (_request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 403 });
  const userId = session.user.id!;

  const [summary, recentTransactions, activeChallenges] = await Promise.all([
    getXpSummary(tenantId, userId),
    prisma.lmsXpTransaction.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, reason: true, amount: true, balance: true, createdAt: true },
    }),
    prisma.lmsChallengeParticipant.findMany({
      where: { tenantId, userId, isCompleted: false },
      include: { challenge: { select: { title: true, criteria: true, xpReward: true, endsAt: true } } },
      take: 10,
    }),
  ]);

  return NextResponse.json({
    data: {
      ...summary,
      recentTransactions,
      activeChallenges: activeChallenges.map(p => ({
        id: p.challengeId, title: p.challenge.title, criteria: p.challenge.criteria,
        xpReward: p.challenge.xpReward, endsAt: p.challenge.endsAt, progress: p.progress,
      })),
    },
  });
}, { skipCsrf: true });
