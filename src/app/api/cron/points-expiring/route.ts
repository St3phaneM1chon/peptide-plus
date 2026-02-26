export const dynamic = 'force-dynamic';

// FIXED: F-081 - Response only returns aggregate stats, not per-user details (see summary field in response)

/**
 * CRON Job - Rappel de points de fidelite qui expirent
 *
 * Deux actions:
 * 1. Envoie un email de rappel 30 jours avant l'expiration des points
 * 2. Notifie les utilisateurs inactifs depuis 11 mois (points vont expirer dans 1 mois)
 *
 * - Groupe les points expirants par utilisateur
 * - Log chaque envoi dans EmailLog
 * - Traitement par lots de 10 pour eviter les timeouts
 *
 * Configuration Vercel (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/points-expiring",
 *     "schedule": "0 11 * * 1"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { sendEmail, pointsExpiringEmail, generateUnsubscribeUrl } from '@/lib/email';
// FLAW-063 FIX: Import bounce suppression to skip hard-bounced addresses
import { shouldSuppressEmail } from '@/lib/email/bounce-handler';
import { withJobLock } from '@/lib/cron-lock';
import { logger } from '@/lib/logger';

const BATCH_SIZE = 10;
const INACTIVITY_MONTHS = 11;

export async function GET(request: NextRequest) {
  // Verify cron secret (fail-closed, timing-safe comparison)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const providedSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  let secretsMatch = false;
  try {
    const a = Buffer.from(cronSecret, 'utf8');
    const b = Buffer.from(providedSecret, 'utf8');
    secretsMatch = a.length === b.length && timingSafeEqual(a, b);
  } catch { secretsMatch = false; }

  if (!secretsMatch) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return withJobLock('points-expiring', async () => {
    const startTime = Date.now();

    try {
      // === FIX F-011: ACTUALLY EXPIRE past-due points ===
      // Find transactions with expiresAt in the past that haven't been expired yet
      const now = new Date();
      const expiredTransactions = await db.loyaltyTransaction.findMany({
        where: {
          points: { gt: 0 },
          expiresAt: { lt: now },
          // Only EARN types that haven't been offset by an EXPIRE transaction
          type: { in: ['EARN_PURCHASE', 'EARN_REFERRAL', 'EARN_REVIEW', 'EARN_SIGNUP', 'EARN_BIRTHDAY', 'EARN_BONUS'] },
        },
        include: {
          user: {
            select: { id: true, loyaltyPoints: true },
          },
        },
      });

      // N+1 FIX: Batch-fetch all existing EXPIRE transactions to check idempotency
      const expiredTxIds = expiredTransactions.map(tx => tx.id);
      const existingExpires = expiredTxIds.length > 0
        ? await db.loyaltyTransaction.findMany({
            where: {
              type: 'EXPIRE',
              description: { not: null },
            },
            select: { description: true },
          })
        : [];
      // Build a set of transaction IDs that already have EXPIRE records
      const alreadyExpiredTxIds = new Set<string>();
      for (const expire of existingExpires) {
        if (expire.description) {
          for (const txId of expiredTxIds) {
            if (expire.description.includes(txId)) {
              alreadyExpiredTxIds.add(txId);
            }
          }
        }
      }

      // Group expired points by user
      const expiredByUser: Record<string, { userId: string; totalExpired: number; transactionIds: string[] }> = {};
      for (const tx of expiredTransactions) {
        // Check if an EXPIRE transaction already exists for this transaction (idempotency)
        if (alreadyExpiredTxIds.has(tx.id)) continue;

        if (!expiredByUser[tx.userId]) {
          expiredByUser[tx.userId] = { userId: tx.userId, totalExpired: 0, transactionIds: [] };
        }
        expiredByUser[tx.userId].totalExpired += tx.points;
        expiredByUser[tx.userId].transactionIds.push(tx.id);
      }

      let expiredCount = 0;
      for (const data of Object.values(expiredByUser)) {
        if (data.totalExpired <= 0) continue;
        try {
          await db.$transaction(async (tx) => {
            // Deduct expired points from user balance
            const updatedUser = await tx.user.update({
              where: { id: data.userId },
              data: { loyaltyPoints: { decrement: Math.min(data.totalExpired, data.totalExpired) } },
              select: { loyaltyPoints: true },
            });
            // Ensure points don't go negative
            if (updatedUser.loyaltyPoints < 0) {
              await tx.user.update({
                where: { id: data.userId },
                data: { loyaltyPoints: 0 },
              });
            }
            // Create EXPIRE transaction for audit trail
            await tx.loyaltyTransaction.create({
              data: {
                userId: data.userId,
                type: 'EXPIRE',
                points: -data.totalExpired,
                description: `Points expired (refs: ${data.transactionIds.join(', ')})`,
                balanceAfter: Math.max(0, updatedUser.loyaltyPoints),
              },
            });
          });
          expiredCount++;
        } catch (err) {
          logger.error(`[CRON:POINTS] Failed to expire points for user ${data.userId}`, { error: err instanceof Error ? err.message : String(err) });
        }
      }

      logger.info(`[CRON:POINTS] Expired points for ${expiredCount} users (${Object.keys(expiredByUser).length} total)`);

      // === STRATEGY 1: Points with explicit expiresAt in ~30 days ===
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const thirtyOneDaysFromNow = new Date();
    thirtyOneDaysFromNow.setDate(thirtyOneDaysFromNow.getDate() + 31);

    const expiringTransactions = await db.loyaltyTransaction.findMany({
      where: {
        type: 'EARN_PURCHASE',
        points: { gt: 0 },
        expiresAt: {
          gte: thirtyDaysFromNow,
          lt: thirtyOneDaysFromNow,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            locale: true,
            loyaltyPoints: true,
          },
        },
      },
    });

    // === STRATEGY 2: Users with points but no activity in 11 months ===
    const elevenMonthsAgo = new Date();
    elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - INACTIVITY_MONTHS);

    const inactiveUsersWithPoints = await db.user.findMany({
      where: {
        loyaltyPoints: { gt: 0 },
        // No loyalty transaction in 11 months
        loyaltyTransactions: {
          none: {
            createdAt: { gte: elevenMonthsAgo },
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        locale: true,
        loyaltyPoints: true,
      },
    });

    // Merge both strategies into a unified map: userId -> points data
    const userPointsMap: Record<
      string,
      {
        user: {
          id: string;
          name: string | null;
          email: string;
          locale: string;
          loyaltyPoints: number;
        };
        expiringPoints: number;
        expiryDate: Date;
        source: 'explicit' | 'inactivity' | 'both';
      }
    > = {};

    // Add users from explicit expiry transactions
    for (const tx of expiringTransactions) {
      const userId = tx.userId;
      if (!userPointsMap[userId]) {
        userPointsMap[userId] = {
          user: tx.user,
          expiringPoints: 0,
          expiryDate: tx.expiresAt || thirtyDaysFromNow,
          source: 'explicit',
        };
      }
      userPointsMap[userId].expiringPoints += tx.points;
    }

    // Add inactive users (their entire balance is at risk)
    for (const user of inactiveUsersWithPoints) {
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 1); // 1 month until full expiry

      if (userPointsMap[user.id]) {
        // User already has explicit expiring points; merge
        userPointsMap[user.id].source = 'both';
        // Use the larger of the two expiring amounts
        if (user.loyaltyPoints > userPointsMap[user.id].expiringPoints) {
          userPointsMap[user.id].expiringPoints = user.loyaltyPoints;
        }
      } else {
        userPointsMap[user.id] = {
          user,
          expiringPoints: user.loyaltyPoints,
          expiryDate,
          source: 'inactivity',
        };
      }
    }

    // Check if we already sent a points-expiring email to these users recently (within 7 days)
    const userIds = Object.keys(userPointsMap);
    if (userIds.length > 0) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentEmails = await db.emailLog.findMany({
        where: {
          templateId: 'points-expiring',
          to: { in: Object.values(userPointsMap).map((u) => u.user.email) },
          status: 'sent',
          sentAt: { gte: sevenDaysAgo },
        },
        select: { to: true },
      });

      const recentlyEmailed = new Set(recentEmails.map((e) => e.to));
      for (const userId of userIds) {
        if (recentlyEmailed.has(userPointsMap[userId].user.email)) {
          delete userPointsMap[userId];
        }
      }
    }

    // FLAW-043 FIX: Check notification preferences - respect users who opted out of loyalty updates
    const remainingUserIds = Object.keys(userPointsMap);
    if (remainingUserIds.length > 0) {
      const notifPrefs = await db.notificationPreference.findMany({
        where: {
          userId: { in: remainingUserIds },
          loyaltyUpdates: false,
        },
        select: { userId: true },
      }).catch(() => [] as { userId: string }[]);

      const optedOutUserIds = new Set(notifPrefs.map((p) => p.userId));
      for (const userId of remainingUserIds) {
        if (optedOutUserIds.has(userId)) {
          delete userPointsMap[userId];
        }
      }
    }

    const eligibleUsers = Object.entries(userPointsMap);

    logger.info(
      `[CRON:POINTS] Found ${eligibleUsers.length} users with points expiring ` +
      `(${expiringTransactions.length} explicit transactions, ${inactiveUsersWithPoints.length} inactive users)`
    );

    const results: Array<{
      userId: string;
      email: string;
      expiringPoints: number;
      source: string;
      success: boolean;
      messageId?: string;
      error?: string;
    }> = [];

    // Process in batches
    for (let i = 0; i < eligibleUsers.length; i += BATCH_SIZE) {
      const batch = eligibleUsers.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async ([userId, data]) => {
        try {
          // FLAW-063 FIX: Check bounce suppression before sending
          const { suppressed } = await shouldSuppressEmail(data.user.email);
          if (suppressed) {
            return { userId, email: data.user.email, expiringPoints: data.expiringPoints, source: data.source, success: false, error: 'bounce_suppressed' };
          }

          // Generate unsubscribe URL (CAN-SPAM / RGPD / LCAP compliance)
          const unsubscribeUrl = await generateUnsubscribeUrl(data.user.email, 'marketing', userId).catch(() => undefined);

          const emailContent = pointsExpiringEmail({
            customerName: data.user.name || 'Client',
            customerEmail: data.user.email,
            expiringPoints: data.expiringPoints,
            currentPoints: data.user.loyaltyPoints,
            expiryDate: data.expiryDate,
            locale: (data.user.locale as 'fr' | 'en') || 'fr',
            unsubscribeUrl,
          });

          const result = await sendEmail({
            to: { email: data.user.email, name: data.user.name || undefined },
            subject: emailContent.subject,
            html: emailContent.html,
            tags: ['points-expiring', 'automated', data.source],
            unsubscribeUrl,
          });

          // Log to EmailLog
          // NOTE: FLAW-065 - userId field on EmailLog deferred; email-based lookup is sufficient for current scale
          await db.emailLog.create({
            data: {
              templateId: 'points-expiring',
              to: data.user.email,
              subject: emailContent.subject,
              status: result.success ? 'sent' : 'failed',
              error: result.success ? null : 'Send failed',
            },
          }).catch((err) => logger.error('Failed to create EmailLog entry', { error: err instanceof Error ? err.message : String(err) }));

          logger.info(
            `[CRON:POINTS] Email sent to ${data.user.email} ` +
            `(${data.expiringPoints} pts, source: ${data.source}, ${result.success ? 'OK' : 'FAILED'})`
          );

          return {
            userId,
            email: data.user.email,
            expiringPoints: data.expiringPoints,
            source: data.source,
            success: result.success,
            messageId: result.messageId,
          };
        } catch (error) {
          logger.error(`[CRON:POINTS] Failed for ${data.user.email}`, { error: error instanceof Error ? error.message : String(error) });

          await db.emailLog.create({
            data: {
              templateId: 'points-expiring',
              to: data.user.email,
              subject: 'Points expiring',
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          }).catch((err) => logger.error('Failed to create failure EmailLog entry', { error: err instanceof Error ? err.message : String(err) }));

          return {
            userId,
            email: data.user.email,
            expiringPoints: data.expiringPoints,
            source: data.source,
            success: false,
            error: 'Failed to process points expiring email',
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;
    const duration = Date.now() - startTime;

    logger.info(
      `[CRON:POINTS] Complete: ${successCount} sent, ${failCount} failed, ${duration}ms`
    );

    return NextResponse.json({
      success: true,
      date: new Date().toISOString(),
      processed: eligibleUsers.length,
      sent: successCount,
      failed: failCount,
      durationMs: duration,
      pointsExpired: {
        usersProcessed: expiredCount,
        totalUsersWithExpiredPoints: Object.keys(expiredByUser).length,
      },
      breakdown: {
        explicitExpiry: expiringTransactions.length,
        inactiveUsers: inactiveUsersWithPoints.length,
        afterDedup: eligibleUsers.length,
      },
      // FIX F-081: Don't expose user emails/IDs in the response - return only aggregate stats
      summary: {
        totalProcessed: eligibleUsers.length,
        emailsSent: successCount,
        emailsFailed: failCount,
      },
    });
    } catch (error) {
      logger.error('[CRON:POINTS] Job error', { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json(
        {
          error: 'Internal server error',
          durationMs: Date.now() - startTime,
        },
        { status: 500 }
      );
    }
  });
}

// Allow POST for manual testing
export { GET as POST };
