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

  // FIX P7-02: Dedup check INSIDE transaction to prevent race condition
  // Returns null for dedup hit (no XP awarded), or the new balance number
  const txResult = await prisma.$transaction(async (tx) => {
    // Dedup check inside transaction to prevent double XP for same event
    if (sourceId) {
      const existing = await tx.lmsXpTransaction.findFirst({
        where: { tenantId, userId, sourceId },
        select: { balance: true },
      });
      if (existing) return { dedup: true as const, balance: existing.balance };
    }

    const lastTransaction = await tx.lmsXpTransaction.findFirst({
      where: { tenantId, userId },
      orderBy: { createdAt: 'desc' },
      select: { balance: true },
    });

    const currentBalance = lastTransaction?.balance ?? 0;
    const balance = currentBalance + amount;

    await tx.lmsXpTransaction.create({
      data: {
        tenantId,
        userId,
        amount,
        reason,
        sourceId: sourceId ?? null,
        balance,
      },
    });

    return { dedup: false as const, balance };
  });

  // If dedup hit, return early — no side effects needed
  if (txResult.dedup) return { amount: 0, newBalance: txResult.balance };

  const newBalance = txResult.balance;

  // Update leaderboard (non-blocking, upsert to create if missing)
  await prisma.lmsLeaderboard.upsert({
    where: { tenantId_userId_period: { tenantId, userId, period: 'all_time' } },
    update: { totalPoints: newBalance },
    create: { tenantId, userId, totalPoints: newBalance, displayName: 'Student', rank: 0, period: 'all_time' },
  }).catch((e) => { if (typeof console !== "undefined") console.warn("[LMS] Non-blocking op failed:", e instanceof Error ? e.message : e); });

  // Check challenge progress (guard against recursive calls)
  if (reason !== 'challenge') {
    await updateChallengeProgress(tenantId, userId, reason);
  }

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
  // FIX P3: Level 0 when no XP, level 1 starts at 1 XP
  // FIX P7-07: Cap at MAX_LEVEL to prevent unbounded growth
  const MAX_LEVEL = 50;
  const level = balance > 0 ? Math.min(MAX_LEVEL, Math.floor(balance / 500) + 1) : 0;
  const xpToNextLevel = level >= MAX_LEVEL ? 0 : (balance > 0 ? 500 - (balance % 500) : 500);

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
    include: { challenge: { select: { criteria: true, xpReward: true, badgeId: true } } },
    take: 20, // FIX P3: Limit to prevent large result sets
  });

  for (const participant of participants) {
    const criteria = participant.challenge.criteria as { action?: string; count?: number } | null;
    if (!criteria?.action || criteria.action !== action) continue;

    // FIX P7-01: Use atomic increment to prevent race condition on progress
    const updated = await prisma.lmsChallengeParticipant.update({
      where: { id: participant.id },
      data: { progress: { increment: 1 } },
    });

    const isCompleted = updated.progress >= (criteria.count ?? 1);

    if (isCompleted && !participant.isCompleted) {
      await prisma.lmsChallengeParticipant.update({
        where: { id: participant.id },
        data: { isCompleted: true, completedAt: now },
      });
    }

    // Award XP for completing challenge
    if (isCompleted && !participant.xpAwarded) {
      await awardXp(tenantId, userId, 'challenge', participant.challengeId, participant.challenge.xpReward);
      await prisma.lmsChallengeParticipant.update({
        where: { id: participant.id },
        data: { xpAwarded: true },
      });

      // FIX P7-09: Award badge if challenge has one
      if (participant.challenge.badgeId) {
        const alreadyAwarded = await prisma.lmsBadgeAward.findFirst({
          where: { tenantId, badgeId: participant.challenge.badgeId, userId },
          select: { id: true },
        });
        if (!alreadyAwarded) {
          await prisma.lmsBadgeAward.create({
            data: { tenantId, badgeId: participant.challenge.badgeId, userId },
          });
        }
      }

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
      }).catch((e) => { if (typeof console !== "undefined") console.warn("[LMS] Non-blocking op failed:", e instanceof Error ? e.message : e); });
    }
  }
}

/**
 * FIX P7-11: Update daily streak for a user.
 * Called when a lesson is completed. Increments streak if consecutive day,
 * resets to 1 if gap > 1 day, no-op if already counted today.
 */
export async function updateStreak(tenantId: string, userId: string): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const streak = await prisma.lmsStreak.findFirst({
    where: { tenantId, userId },
  });

  if (!streak) {
    await prisma.lmsStreak.create({
      data: { tenantId, userId, currentStreak: 1, longestStreak: 1, lastActivityDate: today },
    });
    return;
  }

  const lastDate = streak.lastActivityDate ? new Date(streak.lastActivityDate) : null;
  if (lastDate) lastDate.setHours(0, 0, 0, 0);

  if (lastDate && lastDate.getTime() === today.getTime()) return; // Already counted today

  const newStreak = lastDate && lastDate.getTime() === yesterday.getTime()
    ? streak.currentStreak + 1
    : 1; // Reset if gap > 1 day

  await prisma.lmsStreak.update({
    where: { id: streak.id },
    data: {
      currentStreak: newStreak,
      longestStreak: Math.max(newStreak, streak.longestStreak),
      lastActivityDate: today,
    },
  });
}
