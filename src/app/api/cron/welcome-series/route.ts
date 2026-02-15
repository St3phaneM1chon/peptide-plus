export const dynamic = 'force-dynamic';

/**
 * CRON Job - Serie d'emails de bienvenue
 * Envoie un email de suivi 3 jours apres l'inscription
 *
 * Criteres:
 * - Utilisateur cree il y a exactement 3 jours (entre 3 et 4 jours pour la fenetre)
 * - N'a pas deja recu l'email de bienvenue follow-up (verifie via EmailLog)
 *
 * Contenu de l'email:
 * - Rappel des points de bienvenue
 * - Code de parrainage personnel
 * - Liens vers le catalogue et le programme de fidelite
 *
 * - Log chaque envoi dans EmailLog
 * - Traitement par lots de 10 pour eviter les timeouts
 *
 * Configuration Vercel (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/welcome-series",
 *     "schedule": "0 10 * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendEmail, welcomeEmail } from '@/lib/email';

const BATCH_SIZE = 10;
const FOLLOW_UP_DAYS = 3;
const WELCOME_POINTS = 100; // Default welcome points to mention

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron secret (fail-closed)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    // Time window: users created between 3 and 4 days ago
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - FOLLOW_UP_DAYS);
    threeDaysAgo.setHours(0, 0, 0, 0);

    const fourDaysAgo = new Date(now);
    fourDaysAgo.setDate(fourDaysAgo.getDate() - (FOLLOW_UP_DAYS + 1));
    fourDaysAgo.setHours(0, 0, 0, 0);

    // Find users created 3 days ago
    const newUsers = await db.user.findMany({
      where: {
        createdAt: {
          gte: fourDaysAgo,
          lt: threeDaysAgo,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        locale: true,
        referralCode: true,
        loyaltyPoints: true,
      },
    });

    console.log(`[CRON:WELCOME] Found ${newUsers.length} users created ~${FOLLOW_UP_DAYS} days ago`);

    // Filter out users who already received the welcome-series email
    let eligibleUsers = newUsers;
    if (newUsers.length > 0) {
      const alreadySent = await db.emailLog.findMany({
        where: {
          templateId: 'welcome-series-followup',
          to: { in: newUsers.map((u) => u.email) },
          status: 'sent',
        },
        select: { to: true },
      });
      const alreadySentSet = new Set(alreadySent.map((e) => e.to));
      eligibleUsers = newUsers.filter((u) => !alreadySentSet.has(u.email));
    }

    console.log(`[CRON:WELCOME] ${eligibleUsers.length} users eligible after dedup`);

    const results: Array<{
      userId: string;
      email: string;
      success: boolean;
      messageId?: string;
      error?: string;
    }> = [];

    // Process in batches
    for (let i = 0; i < eligibleUsers.length; i += BATCH_SIZE) {
      const batch = eligibleUsers.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async (user) => {
        try {
          // Generate a referral code if user doesn't have one
          let referralCode = user.referralCode;
          if (!referralCode) {
            referralCode = `REF${user.id.slice(0, 6).toUpperCase()}`;
            try {
              await db.user.update({
                where: { id: user.id },
                data: { referralCode },
              });
            } catch {
              // Referral code might conflict; use a fallback
              referralCode = `REF${user.id.slice(0, 4).toUpperCase()}${Date.now().toString(36).slice(-3).toUpperCase()}`;
              await db.user.update({
                where: { id: user.id },
                data: { referralCode },
              }).catch(() => {
                // If still fails, proceed without code
                referralCode = '';
              });
            }
          }

          // Use the marketing welcome template
          const emailContent = welcomeEmail({
            customerName: user.name || 'Client',
            customerEmail: user.email,
            welcomePoints: WELCOME_POINTS,
            referralCode: referralCode || '',
            locale: (user.locale as 'fr' | 'en') || 'fr',
          });

          // Customize subject for follow-up
          const isFr = (user.locale || 'fr') !== 'en';
          const followUpSubject = isFr
            ? `Comment se passe votre experience, ${user.name || 'Client'}? Decouvrez nos produits!`
            : `How's your experience going, ${user.name || 'Client'}? Discover our products!`;

          const result = await sendEmail({
            to: { email: user.email, name: user.name || undefined },
            subject: followUpSubject,
            html: emailContent.html,
            tags: ['welcome-series', 'follow-up', 'automated'],
          });

          // Log to EmailLog
          await db.emailLog.create({
            data: {
              templateId: 'welcome-series-followup',
              to: user.email,
              subject: followUpSubject,
              status: result.success ? 'sent' : 'failed',
              error: result.success ? null : 'Send failed',
            },
          }).catch(console.error);

          // Also log to AuditLog for traceability
          await db.auditLog.create({
            data: {
              userId: user.id,
              action: 'EMAIL_SENT',
              entityType: 'Email',
              details: JSON.stringify({
                type: 'WELCOME_SERIES_FOLLOWUP',
                locale: user.locale,
                sent: result.success,
              }),
            },
          }).catch(console.error);

          console.log(
            `[CRON:WELCOME] Follow-up email sent to ${user.email} (${result.success ? 'OK' : 'FAILED'})`
          );

          return {
            userId: user.id,
            email: user.email,
            success: result.success,
            messageId: result.messageId,
          };
        } catch (error) {
          console.error(`[CRON:WELCOME] Failed for ${user.email}:`, error);

          await db.emailLog.create({
            data: {
              templateId: 'welcome-series-followup',
              to: user.email,
              subject: 'Welcome follow-up',
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          }).catch(console.error);

          return {
            userId: user.id,
            email: user.email,
            success: false,
            error: 'Failed to process welcome series email',
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
      `[CRON:WELCOME] Complete: ${successCount} sent, ${failCount} failed, ${duration}ms`
    );

    return NextResponse.json({
      success: true,
      date: now.toISOString(),
      totalNewUsers: newUsers.length,
      eligible: eligibleUsers.length,
      sent: successCount,
      failed: failCount,
      durationMs: duration,
      results,
    });
  } catch (error) {
    console.error('[CRON:WELCOME] Job error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// Allow POST for manual testing
export { GET as POST };
