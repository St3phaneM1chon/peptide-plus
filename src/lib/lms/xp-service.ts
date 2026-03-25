/**
 * XP Points Service — Track and award experience points
 *
 * XP Rewards:
 * - lesson_complete: 10 XP
 * - quiz_pass: 25 XP
 * - course_complete: 100 XP
 * - streak_bonus (7 days): 50 XP
 * - daily_login: 5 XP
 * - challenge: variable
 */

import { prisma } from '@/lib/db';

const XP_VALUES: Record<string, number> = {
  lesson_complete: 10,
  quiz_pass: 25,
  course_complete: 100,
  streak_bonus: 50,
  daily_login: 5,
};

/**
 * Award XP to a user for an action.
 * Automatically updates the running balance.
 */
export async function awardXp(
  tenantId: string,
  userId: string,
  reason: string,
  sourceId?: string,
  customAmount?: number
): Promise<{ amount: number; newBalance: number }> {
  const amount = customAmount ?? XP_VALUES[reason] ?? 0;
  if (amount === 0) return { amount: 0, newBalance: 0 };

  // Get current balance
  const lastTransaction = await prisma.lmsXpTransaction.findFirst({
    where: { tenantId, userId },
    orderBy: { createdAt: 'desc' },
    select: { balance: true },
  });

  const currentBalance = lastTransaction?.balance ?? 0;
  const newBalance = currentBalance + amount;

  await prisma.lmsXpTransaction.create({
    data: {
      tenantId,
      userId,
      amount,
      reason,
      sourceId: sourceId ?? null,
      balance: newBalance,
    },
  });

  // Update leaderboard
  await prisma.lmsLeaderboard.updateMany({
    where: { tenantId, userId },
    data: { totalPoints: newBalance },
  });

  // Check challenge progress
  await updateChallengeProgress(tenantId, userId, reason);

  return { amount, newBalance };
}

/**
 * Get user's current XP balance and recent transactions.
 */
export async function getXpSummary(tenantId: string, userId: string) {
  const [lastTransaction, recentTransactions, totalEarned] = await Promise.all([
    prisma.lmsXpTransaction.findFirst({
      where: { tenantId, userId },
      orderBy: { createdAt: 'desc' },
      select: { balance: true },
    }),
    prisma.lmsXpTransaction.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { amount: true, reason: true, createdAt: true },
    }),
    prisma.lmsXpTransaction.aggregate({
      where: { tenantId, userId, amount: { gt: 0 } },
      _sum: { amount: true },
    }),
  ]);

  const balance = lastTransaction?.balance ?? 0;
  const level = Math.floor(balance / 500) + 1; // Level up every 500 XP
  const xpToNextLevel = 500 - (balance % 500);

  return {
    balance,
    totalEarned: totalEarned._sum.amount ?? 0,
    level,
    xpToNextLevel,
    recentTransactions,
  };
}

/**
 * Update challenge progress when user performs an action.
 */
async function updateChallengeProgress(tenantId: string, userId: string, action: string) {
  const now = new Date();

  // Find active challenges the user is participating in
  const participants = await prisma.lmsChallengeParticipant.findMany({
    where: {
      tenantId,
      userId,
      isCompleted: false,
      challenge: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
    },
    include: { challenge: { select: { criteria: true, xpReward: true } } },
  });

  for (const participant of participants) {
    const criteria = participant.challenge.criteria as { action?: string; count?: number } | null;
    if (!criteria?.action || criteria.action !== action) continue;

    const newProgress = participant.progress + 1;
    const isCompleted = newProgress >= (criteria.count ?? 1);

    await prisma.lmsChallengeParticipant.update({
      where: { id: participant.id },
      data: {
        progress: newProgress,
        isCompleted,
        completedAt: isCompleted ? now : null,
      },
    });

    // Award XP for completing challenge
    if (isCompleted && !participant.xpAwarded) {
      await awardXp(tenantId, userId, 'challenge', participant.challengeId, participant.challenge.xpReward);
      await prisma.lmsChallengeParticipant.update({
        where: { id: participant.id },
        data: { xpAwarded: true },
      });

      // Create notification
      await prisma.lmsNotification.create({
        data: {
          tenantId,
          userId,
          type: 'challenge_complete',
          title: 'Defi termine!',
          message: `+${participant.challenge.xpReward} XP`,
          link: '/learn/achievements',
        },
      }).catch(() => {});
    }
  }
}
