export const dynamic = 'force-dynamic';

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
import { db } from '@/lib/db';
import { sendEmail, pointsExpiringEmail, generateUnsubscribeUrl } from '@/lib/email';
import { withJobLock } from '@/lib/cron-lock';

const BATCH_SIZE = 10;
const INACTIVITY_MONTHS = 11;

export async function GET(request: NextRequest) {
  // Verify cron secret (fail-closed)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return withJobLock('points-expiring', async () => {
    const startTime = Date.now();

    try {
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

    const eligibleUsers = Object.entries(userPointsMap);

    console.log(
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
          await db.emailLog.create({
            data: {
              templateId: 'points-expiring',
              to: data.user.email,
              subject: emailContent.subject,
              status: result.success ? 'sent' : 'failed',
              error: result.success ? null : 'Send failed',
            },
          }).catch(console.error);

          console.log(
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
          console.error(`[CRON:POINTS] Failed for ${data.user.email}:`, error);

          await db.emailLog.create({
            data: {
              templateId: 'points-expiring',
              to: data.user.email,
              subject: 'Points expiring',
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          }).catch(console.error);

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

    console.log(
      `[CRON:POINTS] Complete: ${successCount} sent, ${failCount} failed, ${duration}ms`
    );

    return NextResponse.json({
      success: true,
      date: new Date().toISOString(),
      processed: eligibleUsers.length,
      sent: successCount,
      failed: failCount,
      durationMs: duration,
      breakdown: {
        explicitExpiry: expiringTransactions.length,
        inactiveUsers: inactiveUsersWithPoints.length,
        afterDedup: eligibleUsers.length,
      },
      results,
    });
    } catch (error) {
      console.error('[CRON:POINTS] Job error:', error);
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
