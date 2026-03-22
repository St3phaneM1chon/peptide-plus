export const dynamic = 'force-dynamic';

/**
 * CRON Job - Churn Prediction Alerts
 * Identifies at-risk customers and sends a "We miss you" re-engagement email.
 *
 * A customer is considered at-risk if they meet ANY of the following criteria:
 *   1. CustomerMetrics.churnScore > 0.7  (ML-computed churn probability)
 *   2. CustomerMetrics.lastOrderDays > 90 AND totalOrders >= 2
 *      (had repeat business but has gone dormant)
 *
 * De-duplication: a customer is skipped if they already received a churn-alert
 * email in the past 30 days (checked via EmailLog).
 *
 * Configuration Vercel (vercel.json):
 * Schedule: weekly on Monday at 9 AM ET (0 9 * * 1)
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { sendEmail, sunsetEmail, generateUnsubscribeUrl } from '@/lib/email';
import { shouldSuppressEmail } from '@/lib/email/bounce-handler';
import { logger } from '@/lib/logger';
import { withJobLock } from '@/lib/cron-lock';
import { forEachActiveTenant } from '@/lib/tenant-cron';

// Re-engagement discount code injected into step-2 sunset email
const CHURN_DISCOUNT_CODE = process.env.CHURN_DISCOUNT_CODE || 'COMEBACK15';
const CHURN_DISCOUNT_PERCENT = 15;

// Cooldown: do not re-send churn alert if one was sent within this many days
const CHURN_ALERT_COOLDOWN_DAYS = 30;

const BATCH_SIZE = 10;

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
  } catch {
    secretsMatch = false;
  }

  if (!secretsMatch) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return withJobLock('churn-alerts', async () => {
    const startTime = Date.now();

    try {
      // Multi-tenant: iterate over all active tenants
      const tenantResult = await forEachActiveTenant(async (tenant) => {
      // ── 1. Fetch at-risk customer metrics ──────────────────────────────────
      // Criteria: churnScore > 0.7 OR (lastOrderDays > 90 AND totalOrders >= 2)
      // Prisma middleware auto-filters by tenant
      const atRiskMetrics = await prisma.customerMetrics.findMany({
        where: {
          OR: [
            { churnScore: { gt: 0.7 } },
            {
              lastOrderDays: { gt: 90 },
              totalOrders: { gte: 2 },
            },
          ],
        },
        select: {
          userId: true,
          churnScore: true,
          lastOrderDays: true,
          totalOrders: true,
          lastOrderAt: true,
        },
      });

      logger.info('Churn alerts cron: found at-risk customers', {
        count: atRiskMetrics.length,
      });

      if (atRiskMetrics.length === 0) {
        return; // No at-risk customers for this tenant
      }

      // ── 2. Load user details for at-risk customers ─────────────────────────
      const userIds = atRiskMetrics.map((m) => m.userId).filter((id): id is string => id != null);

      const users = await prisma.user.findMany({
        where: {
          id: { in: userIds },
          // Exclude banned users and non-customers
          isBanned: false,
          role: 'CUSTOMER',
        },
        select: {
          id: true,
          name: true,
          email: true,
          locale: true,
        },
      });

      const userMap = new Map(users.map((u) => [u.id, u]));

      // ── 3. De-duplicate: skip customers already notified within cooldown ───
      const cooldownDate = new Date(
        Date.now() - CHURN_ALERT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
      );

      // Single query to find all emails recently sent to these users
      const recentlySentEmails = await prisma.emailLog.findMany({
        where: {
          to: { in: users.map((u) => u.email) },
          templateId: 'churn-alert',
          sentAt: { gte: cooldownDate },
          status: 'sent',
        },
        select: { to: true },
      });

      const recentlySentSet = new Set(recentlySentEmails.map((e) => e.to));

      // Build final list of candidates to notify
      const candidates = atRiskMetrics.filter((m) => {
        if (!m.userId) return false;
        const user = userMap.get(m.userId);
        if (!user) return false; // banned or non-customer
        if (recentlySentSet.has(user.email)) return false; // already notified
        return true;
      });

      logger.info('Churn alerts cron: candidates after de-duplication', {
        totalAtRisk: atRiskMetrics.length,
        afterUserFilter: users.length,
        afterCooldown: candidates.length,
      });

      // ── 4. Send emails in batches ──────────────────────────────────────────
      type AlertResult = {
        userId: string;
        email: string;
        success: boolean;
        messageId?: string;
        error?: string;
        skipped?: boolean;
      };

      const results: AlertResult[] = [];

      for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
        const batch = candidates.slice(i, i + BATCH_SIZE);

        const batchPromises = batch.map(async (metrics): Promise<AlertResult> => {
          const user = userMap.get(metrics.userId!)!;

          try {
            // Bounce suppression check
            const { suppressed } = await shouldSuppressEmail(user.email);
            if (suppressed) {
              logger.info('Churn alert: email suppressed (bounce)', { email: user.email });
              return {
                userId: metrics.userId!,
                email: user.email,
                success: false,
                skipped: true,
                error: 'bounce_suppressed',
              };
            }

            // Generate compliance URLs
            const unsubscribeUrl = await generateUnsubscribeUrl(
              user.email,
              'marketing',
              metrics.userId!,
            ).catch(() => undefined);

            const locale = (user.locale?.startsWith('en') ? 'en' : 'fr') as 'fr' | 'en';

            // Use sunset step 2: "We miss you" with discount incentive
            const emailContent = sunsetEmail({
              customerName: user.name || 'valued customer',
              customerEmail: user.email,
              step: 2,
              discountCode: CHURN_DISCOUNT_CODE,
              discountPercent: CHURN_DISCOUNT_PERCENT,
              locale,
              unsubscribeUrl,
            });

            const result = await sendEmail({
              to: { email: user.email, name: user.name || undefined },
              subject: emailContent.subject,
              html: emailContent.html,
              tags: ['churn-alert', 'automated', 're-engagement'],
              unsubscribeUrl,
              emailType: 'marketing',
            });

            // Log to EmailLog (used for de-duplication on next run)
            await prisma.emailLog
              .create({
                data: {
                  templateId: 'churn-alert',
                  to: user.email,
                  subject: emailContent.subject,
                  status: result.success ? 'sent' : 'failed',
                  messageId: result.messageId || null,
                  error: result.success ? null : 'Send failed',
                },
              })
              .catch((err: unknown) =>
                logger.error('Churn alert: failed to create email log', {
                  email: user.email,
                  error: err instanceof Error ? err.message : String(err),
                }),
              );

            logger.info('Churn alert: email sent', {
              userId: metrics.userId,
              email: user.email,
              churnScore: String(metrics.churnScore),
              lastOrderDays: metrics.lastOrderDays,
              success: result.success,
            });

            return {
              userId: metrics.userId!,
              email: user.email,
              success: result.success,
              messageId: result.messageId,
            };
          } catch (error) {
            logger.error('Churn alert: failed for customer', {
              userId: metrics.userId!,
              email: user.email,
              error: error instanceof Error ? error.message : String(error),
            });

            await prisma.emailLog
              .create({
                data: {
                  templateId: 'churn-alert',
                  to: user.email,
                  subject: 'Churn re-engagement alert',
                  status: 'failed',
                  error: error instanceof Error ? error.message : 'Unknown error',
                },
              })
              .catch((err: unknown) =>
                logger.error('Churn alert: failed to create error log', {
                  email: user.email,
                  error: err instanceof Error ? err.message : String(err),
                }),
              );

            return {
              userId: metrics.userId!,
              email: user.email,
              success: false,
              error: 'Failed to send churn alert',
            };
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        for (const r of batchResults) {
          if (r.status === 'fulfilled') results.push(r.value);
        }
      }

      const sentCount = results.filter((r) => r.success).length;
      const skippedCount = results.filter((r) => r.skipped).length;
      const failedCount = results.filter((r) => !r.success && !r.skipped).length;

      logger.info('Churn alerts cron: job complete', {
        tenantSlug: tenant.slug,
        atRisk: atRiskMetrics.length,
        candidates: candidates.length,
        sent: sentCount,
        skipped: skippedCount,
        failed: failedCount,
      });
    });

      const duration = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        date: new Date().toISOString(),
        tenants: tenantResult,
        durationMs: duration,
      });
    } catch (error) {
      logger.error('Churn alerts cron: job error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        durationMs: Date.now() - startTime,
      });
      return NextResponse.json(
        {
          error: 'Internal server error',
          durationMs: Date.now() - startTime,
        },
        { status: 500 },
      );
    }
  });
}

// Allow POST for manual testing
export { GET as POST };
