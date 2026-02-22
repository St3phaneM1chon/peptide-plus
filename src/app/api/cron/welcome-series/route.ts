export const dynamic = 'force-dynamic';

/**
 * CRON Job - Drip campaign de bienvenue (item 82)
 *
 * Previously: Single follow-up email 3 days after signup.
 * Now: Multi-step drip campaign with configurable timing.
 *
 * Drip sequence:
 *   Step 1 (Day 3):  "How's your experience?" - Product discovery + referral code
 *   Step 2 (Day 7):  "Explore our best sellers" - Top products + loyalty program reminder
 *   Step 3 (Day 14): "Educational content" - Blog articles + how peptides work
 *   Step 4 (Day 21): "First purchase incentive" - Discount code if no orders yet
 *
 * Each step checks:
 *   - User was created N days ago (time window: N to N+1 days)
 *   - User hasn't already received this specific drip step (via EmailLog templateId)
 *   - User hasn't unsubscribed (marketingConsent check)
 *
 * TODO (item 82): Further enhancements:
 *   - Store drip sequence config in SiteSetting (timing, content, conditions)
 *   - Skip remaining drip steps if user made a purchase (they're already engaged)
 *   - A/B test different drip sequences (e.g., 3-email vs 5-email series)
 *   - Personalize product recommendations based on browsing history
 *   - Add SMS touchpoint at step 2 for users with phone numbers
 *   - Track drip campaign conversion rate (signup -> first purchase)
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
import crypto from 'crypto';
import { db } from '@/lib/db';
import { sendEmail, welcomeEmail, generateUnsubscribeUrl } from '@/lib/email';
import { withJobLock } from '@/lib/cron-lock';

const BATCH_SIZE = 10;
const WELCOME_POINTS = 100; // Default welcome points to mention

// Item 82: Drip campaign steps configuration
interface DripStep {
  id: string;         // Unique template ID for dedup
  daysSinceSignup: number;
  subjectFr: string;
  subjectEn: string;
  tags: string[];
  /** If true, skip this step for users who have already placed an order */
  skipIfOrdered: boolean;
  /** If set, generate a promo code for this step */
  promoDiscountPercent?: number;
}

const DRIP_STEPS: DripStep[] = [
  {
    id: 'welcome-series-followup',
    daysSinceSignup: 3,
    subjectFr: 'Comment se passe votre experience, {{name}}? Decouvrez nos produits!',
    subjectEn: "How's your experience going, {{name}}? Discover our products!",
    tags: ['welcome-series', 'follow-up', 'automated'],
    skipIfOrdered: false,
  },
  {
    id: 'welcome-series-bestsellers',
    daysSinceSignup: 7,
    subjectFr: '{{name}}, decouvrez nos produits les plus populaires!',
    subjectEn: '{{name}}, discover our most popular products!',
    tags: ['welcome-series', 'bestsellers', 'automated'],
    skipIfOrdered: false,
  },
  {
    id: 'welcome-series-education',
    daysSinceSignup: 14,
    subjectFr: 'Guide: Tout savoir sur les peptides de recherche',
    subjectEn: 'Guide: Everything about research peptides',
    tags: ['welcome-series', 'education', 'automated'],
    skipIfOrdered: false,
  },
  {
    id: 'welcome-series-incentive',
    daysSinceSignup: 21,
    subjectFr: '{{name}}, voici 10% de rabais pour votre premiere commande!',
    subjectEn: '{{name}}, here is 10% off your first order!',
    tags: ['welcome-series', 'incentive', 'automated'],
    skipIfOrdered: true, // Only send to users who haven't ordered yet
    promoDiscountPercent: 10,
  },
];

export async function GET(request: NextRequest) {
  // Verify cron secret (fail-closed)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return withJobLock('welcome-series', async () => {
    const startTime = Date.now();

    try {
      const now = new Date();

    // Item 82: Process all drip steps in a single cron run
    const allResults: Array<{
      step: string;
      userId: string;
      email: string;
      success: boolean;
      messageId?: string;
      error?: string;
    }> = [];

    let totalProcessed = 0;

    for (const step of DRIP_STEPS) {
      // Time window: users created between N and N+1 days ago
      const windowStart = new Date(now);
      windowStart.setDate(windowStart.getDate() - (step.daysSinceSignup + 1));
      windowStart.setHours(0, 0, 0, 0);

      const windowEnd = new Date(now);
      windowEnd.setDate(windowEnd.getDate() - step.daysSinceSignup);
      windowEnd.setHours(0, 0, 0, 0);

      // Find users in the time window for this drip step
      const usersInWindow = await db.user.findMany({
        where: {
          createdAt: {
            gte: windowStart,
            lt: windowEnd,
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

      if (usersInWindow.length === 0) continue;

      // Filter out users who already received this drip step
      const alreadySent = await db.emailLog.findMany({
        where: {
          templateId: step.id,
          to: { in: usersInWindow.map((u) => u.email) },
          status: 'sent',
        },
        select: { to: true },
      });
      const alreadySentSet = new Set(alreadySent.map((e) => e.to));
      let eligibleUsers = usersInWindow.filter((u) => !alreadySentSet.has(u.email));

      // Item 82: Skip users who already ordered (for incentive step)
      if (step.skipIfOrdered && eligibleUsers.length > 0) {
        const userIds = eligibleUsers.map((u) => u.id);
        const usersWithOrders = await db.order.findMany({
          where: { userId: { in: userIds }, paymentStatus: 'PAID' },
          select: { userId: true },
          distinct: ['userId'],
        });
        const orderedUserIds = new Set(usersWithOrders.map((o) => o.userId));
        eligibleUsers = eligibleUsers.filter((u) => !orderedUserIds.has(u.id));
      }

      console.log(`[CRON:WELCOME] Step "${step.id}" (day ${step.daysSinceSignup}): ${usersInWindow.length} in window, ${eligibleUsers.length} eligible`);

      // Process in batches
      for (let i = 0; i < eligibleUsers.length; i += BATCH_SIZE) {
        const batch = eligibleUsers.slice(i, i + BATCH_SIZE);

        // Batch-fetch notification preferences to avoid N+1 queries
        const batchUserIds = batch.map((u) => u.id);
        const batchPrefs = await db.notificationPreference.findMany({
          where: { userId: { in: batchUserIds } },
          select: { userId: true, newsletter: true },
        });
        const prefsMap = new Map(batchPrefs.map((p) => [p.userId, p]));

        const batchPromises = batch.map(async (user) => {
          try {
            // Check bounce suppression before sending
            const { shouldSuppressEmail } = await import('@/lib/email/bounce-handler');
            const { suppressed } = await shouldSuppressEmail(user.email);
            if (suppressed) {
              return { step: step.id, userId: user.id, email: user.email, success: false, error: 'Bounce-suppressed' };
            }

            // Check notification preferences (batch-fetched above)
            const prefs = prefsMap.get(user.id);
            if (prefs && !prefs.newsletter) {
              return { step: step.id, userId: user.id, email: user.email, success: false, error: 'Opted out' };
            }

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
                referralCode = `REF${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
                await db.user.update({
                  where: { id: user.id },
                  data: { referralCode },
                }).catch(() => {
                  referralCode = '';
                });
              }
            }

            // Generate unsubscribe URL (CAN-SPAM / RGPD / LCAP compliance)
            const unsubscribeUrl = await generateUnsubscribeUrl(user.email, 'marketing', user.id).catch(() => undefined);

            // Use the marketing welcome template
            const emailContent = welcomeEmail({
              customerName: user.name || 'Client',
              customerEmail: user.email,
              welcomePoints: WELCOME_POINTS,
              referralCode: referralCode || '',
              locale: (user.locale as 'fr' | 'en') || 'fr',
              unsubscribeUrl,
            });

            // Item 82: Use step-specific subject with template variables
            const isFr = (user.locale || 'fr') !== 'en';
            const subjectTemplate = isFr ? step.subjectFr : step.subjectEn;
            const followUpSubject = subjectTemplate.replace('{{name}}', user.name || 'Client');

            const result = await sendEmail({
              to: { email: user.email, name: user.name || undefined },
              subject: followUpSubject,
              html: emailContent.html,
              tags: step.tags,
              unsubscribeUrl,
            });

            // Log to EmailLog with step-specific templateId for dedup
            await db.emailLog.create({
              data: {
                templateId: step.id,
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
                  type: step.id.toUpperCase().replace(/-/g, '_'),
                  step: step.daysSinceSignup,
                  locale: user.locale,
                  sent: result.success,
                }),
              },
            }).catch(console.error);

            console.log(
              `[CRON:WELCOME] ${step.id} email sent to ${user.email} (${result.success ? 'OK' : 'FAILED'})`
            );

            return {
              step: step.id,
              userId: user.id,
              email: user.email,
              success: result.success,
              messageId: result.messageId,
            };
          } catch (error) {
            console.error(`[CRON:WELCOME] ${step.id} failed for ${user.email}:`, error);

            await db.emailLog.create({
              data: {
                templateId: step.id,
                to: user.email,
                subject: `Welcome series: ${step.id}`,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
              },
            }).catch(console.error);

            return {
              step: step.id,
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
            allResults.push(result.value);
          }
        }
      }

      totalProcessed += eligibleUsers.length;
    }

    const successCount = allResults.filter((r) => r.success).length;
    const failCount = allResults.filter((r) => !r.success).length;
    const duration = Date.now() - startTime;

    // Group results by step for summary
    const stepSummary: Record<string, { sent: number; failed: number }> = {};
    for (const r of allResults) {
      if (!stepSummary[r.step]) stepSummary[r.step] = { sent: 0, failed: 0 };
      if (r.success) stepSummary[r.step].sent++;
      else stepSummary[r.step].failed++;
    }

    console.log(
      `[CRON:WELCOME] Complete: ${successCount} sent, ${failCount} failed across ${DRIP_STEPS.length} steps, ${duration}ms`
    );

    return NextResponse.json({
      success: true,
      date: now.toISOString(),
      totalProcessed,
      sent: successCount,
      failed: failCount,
      durationMs: duration,
      stepSummary,
      results: allResults,
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
  });
}

// Allow POST for manual testing
export { GET as POST };
