export const dynamic = 'force-dynamic';

/**
 * CRON - A/B Test Winner Check & Auto-Send Remainder
 * GET /api/cron/ab-test-check
 *
 * Finds campaigns with status='AB_TESTING' where the wait period has elapsed,
 * evaluates which variant won using statistical significance, and sends the
 * winning variant to the remaining audience.
 *
 * If no statistically significant winner is found and the wait period has
 * elapsed, the variant with the better raw metric is chosen.
 *
 * Schedule: every 15 minutes
 * {
 *   "crons": [{
 *     "path": "/api/cron/ab-test-check",
 *     "schedule": "0/15 * * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/email-service';
import { generateUnsubscribeUrl } from '@/lib/email/unsubscribe';
import { shouldSuppressEmail } from '@/lib/email/bounce-handler';
import {
  selectWinner,
  isStatisticallySignificant,
  getMetricValue,
  type ABTest,
  type ABTestVariant,
} from '@/lib/email/ab-test-engine';
import { escapeHtml } from '@/lib/email/templates/base-template';
import { withJobLock } from '@/lib/cron-lock';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  // Auth: cron secret via Authorization header
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

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

  return withJobLock('ab-test-check', async () => {
    try {
      const now = new Date();

      // Find campaigns in AB_TESTING status
      const abCampaigns = await prisma.emailCampaign.findMany({
        where: { status: 'AB_TESTING' },
        take: 10,
      });

      if (abCampaigns.length === 0) {
        return NextResponse.json({ success: true, checked: 0 });
      }

      const results: Array<{
        id: string;
        name: string;
        winner?: string;
        significant: boolean;
        sentToRemainder?: number;
        error?: string;
      }> = [];

      for (const campaign of abCampaigns) {
        try {
          let stats: Record<string, unknown> = {};
          try {
            stats = campaign.stats ? JSON.parse(campaign.stats) : {};
          } catch {
            logger.warn('[AB Test Check] Invalid stats JSON', { campaignId: campaign.id });
            continue;
          }

          const abTest = stats.abTest as {
            status: string;
            variantA: ABTestVariant;
            variantB: ABTestVariant;
            remainderCount: number;
            winningMetric: ABTest['metric'];
            confidenceLevel: number;
            waitDurationMinutes: number;
            testStartedAt: string;
            checkWinnerAfter: string;
          } | undefined;

          if (!abTest || abTest.status !== 'RUNNING') {
            continue;
          }

          // Check if wait period has elapsed
          const checkAfter = new Date(abTest.checkWinnerAfter);
          if (now < checkAfter) {
            logger.debug('[AB Test Check] Wait period not yet elapsed', {
              campaignId: campaign.id,
              checkAfter: abTest.checkWinnerAfter,
            });
            continue;
          }

          // Fetch actual open/click counts from EmailLog for each variant
          const [variantAOpens, variantAClicks, variantBOpens, variantBClicks] = await Promise.all([
            prisma.emailLog.count({
              where: {
                templateId: `campaign:${campaign.id}`,
                abVariant: 'A',
                openedAt: { not: null },
              },
            }),
            prisma.emailLog.count({
              where: {
                templateId: `campaign:${campaign.id}`,
                abVariant: 'A',
                clickCount: { gt: 0 },
              },
            }),
            prisma.emailLog.count({
              where: {
                templateId: `campaign:${campaign.id}`,
                abVariant: 'B',
                openedAt: { not: null },
              },
            }),
            prisma.emailLog.count({
              where: {
                templateId: `campaign:${campaign.id}`,
                abVariant: 'B',
                clickCount: { gt: 0 },
              },
            }),
          ]);

          // Update variant stats with real data
          const updatedVariantA: ABTestVariant = {
            ...abTest.variantA,
            opens: variantAOpens,
            clicks: variantAClicks,
          };
          const updatedVariantB: ABTestVariant = {
            ...abTest.variantB,
            opens: variantBOpens,
            clicks: variantBClicks,
          };

          // Check for statistical significance
          const significant = isStatisticallySignificant(
            updatedVariantA,
            updatedVariantB,
            abTest.winningMetric,
            abTest.confidenceLevel
          );

          // Determine winner
          const rateA = getMetricValue(updatedVariantA, abTest.winningMetric);
          const rateB = getMetricValue(updatedVariantB, abTest.winningMetric);
          const winnerVariant = rateA >= rateB ? 'A' : 'B';
          const winnerData = winnerVariant === 'A' ? updatedVariantA : updatedVariantB;

          logger.info('[AB Test Check] Winner determined', {
            campaignId: campaign.id,
            winner: winnerVariant,
            significant,
            rateA: (rateA * 100).toFixed(1) + '%',
            rateB: (rateB * 100).toFixed(1) + '%',
            metric: abTest.winningMetric,
          });

          // Parse the abTestConfig to get the winner's content
          let abTestConfig: {
            variantA: { subject?: string; htmlContent?: string };
            variantB: { subject?: string; htmlContent?: string };
          } | null = null;
          try {
            abTestConfig = campaign.abTestConfig ? JSON.parse(campaign.abTestConfig) : null;
          } catch {
            logger.warn('[AB Test Check] Invalid abTestConfig JSON', { campaignId: campaign.id });
          }

          const winnerSubject = winnerVariant === 'A'
            ? (abTestConfig?.variantA?.subject || campaign.subject)
            : (abTestConfig?.variantB?.subject || campaign.subject);
          const winnerHtmlContent = winnerVariant === 'A'
            ? (abTestConfig?.variantA?.htmlContent || campaign.htmlContent)
            : (abTestConfig?.variantB?.htmlContent || campaign.htmlContent);

          // Build remainder audience (everyone who was NOT in the test pool)
          // We find users who DON'T have an EmailLog for this campaign yet
          const existingRecipientEmails = await prisma.emailLog.findMany({
            where: { templateId: `campaign:${campaign.id}` },
            select: { to: true },
          });
          const alreadySentEmails = new Set(existingRecipientEmails.map(e => e.to.toLowerCase()));

          // Build full audience same as original send
          let allRecipients: Array<{ email: string; name: string | null; id: string }>;
          if (campaign.segmentQuery) {
            let query: Record<string, unknown>;
            try {
              query = JSON.parse(campaign.segmentQuery);
            } catch {
              results.push({ id: campaign.id, name: campaign.name, significant: false, error: 'Invalid segmentQuery' });
              continue;
            }

            const where: Record<string, unknown> = {};
            if (query.loyaltyTier) where.loyaltyTier = query.loyaltyTier;
            if (query.locale) where.locale = query.locale;
            if (query.hasOrdered && query.minOrderValue) {
              where.orders = { some: { total: { gte: parseFloat(String(query.minOrderValue)) } } };
            } else if (query.minOrderValue) {
              where.orders = { some: { total: { gte: parseFloat(String(query.minOrderValue)) } } };
            } else if (query.hasOrdered) {
              where.orders = { some: {} };
            }

            allRecipients = await prisma.user.findMany({
              where: { ...where, emailVerified: { not: null } },
              select: { id: true, email: true, name: true },
            });
          } else {
            allRecipients = await prisma.user.findMany({
              where: { emailVerified: { not: null } },
              select: { id: true, email: true, name: true },
            });
          }

          // Filter to only remainder (not already sent)
          const remainderRecipients = allRecipients.filter(
            r => !alreadySentEmails.has(r.email.toLowerCase())
          );

          // Apply bounce/consent/prefs filters
          const userIds = remainderRecipients.map(r => r.id);
          const userEmails = remainderRecipients.map(r => r.email);

          const [allPrefs, allConsents] = await Promise.all([
            prisma.notificationPreference.findMany({
              where: { userId: { in: userIds } },
              select: { userId: true, newsletter: true, promotions: true },
            }),
            prisma.consentRecord.findMany({
              where: {
                email: { in: userEmails },
                type: { in: ['newsletter', 'marketing'] },
                revokedAt: null,
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
              },
              select: { email: true },
            }),
          ]);

          const prefsMap = new Map(allPrefs.map(p => [p.userId, p]));
          const consentEmails = new Set(allConsents.map(c => c.email.toLowerCase()));

          const validRemainder: typeof remainderRecipients = [];
          for (const r of remainderRecipients) {
            const { suppressed } = await shouldSuppressEmail(r.email);
            if (suppressed) continue;
            const prefs = prefsMap.get(r.id);
            if (prefs && !prefs.newsletter && !prefs.promotions) continue;
            if (!consentEmails.has(r.email.toLowerCase())) continue;
            validRemainder.push(r);
          }

          // Send winning variant to remainder
          let sentToRemainder = 0;
          let failedRemainder = 0;

          for (let i = 0; i < validRemainder.length; i++) {
            if (i > 0 && i % 10 === 0) await new Promise(r => setTimeout(r, 1000));
            const recipient = validRemainder[i];
            try {
              const safeName = escapeHtml(recipient.name || 'Client');
              const safeEmail = escapeHtml(recipient.email);
              const html = winnerHtmlContent
                .replace(/\{\{prenom\}\}/g, safeName)
                .replace(/\{\{email\}\}/g, safeEmail);
              const subject = winnerSubject
                .replace(/\{\{prenom\}\}/g, recipient.name || 'Client');

              const unsubscribeUrl = await generateUnsubscribeUrl(recipient.email, 'marketing', recipient.id).catch(() => undefined);

              // Create EmailLog first for tracking
              const emailLog = await prisma.emailLog.create({
                data: {
                  to: recipient.email,
                  subject,
                  status: 'sending',
                  templateId: `campaign:${campaign.id}`,
                  abVariant: `WINNER_${winnerVariant}`,
                },
              });

              const result = await sendEmail({
                to: { email: recipient.email, name: recipient.name || undefined },
                subject,
                html,
                text: campaign.textContent || undefined,
                tags: ['campaign', campaign.id, 'ab-winner'],
                unsubscribeUrl,
                emailType: 'marketing',
                emailLogId: emailLog.id,
              });

              if (!result.success) {
                await prisma.emailLog.update({
                  where: { id: emailLog.id },
                  data: { status: 'failed', error: result.error || 'Send failed' },
                });
                failedRemainder++;
                continue;
              }

              await prisma.emailLog.update({
                where: { id: emailLog.id },
                data: { status: 'sent', messageId: result.messageId || undefined },
              });
              sentToRemainder++;
            } catch (error) {
              logger.error('[AB Test Check] Failed to send winner to remainder recipient', {
                campaignId: campaign.id,
                email: recipient.email,
                error: error instanceof Error ? error.message : String(error),
              });
              failedRemainder++;
            }
          }

          // Update campaign to SENT with final stats
          const totalSent = (typeof stats.sent === 'number' ? stats.sent : 0) + sentToRemainder;
          const totalFailed = (typeof stats.failed === 'number' ? stats.failed : 0) + failedRemainder;

          await prisma.emailCampaign.update({
            where: { id: campaign.id },
            data: {
              status: 'SENT',
              stats: JSON.stringify({
                ...stats,
                sent: totalSent,
                failed: totalFailed,
                sentCount: totalSent + totalFailed,
                totalCount: totalSent + totalFailed,
                totalRecipients: totalSent + totalFailed,
                abTest: {
                  ...abTest,
                  status: 'COMPLETED',
                  variantA: updatedVariantA,
                  variantB: updatedVariantB,
                  winnerId: winnerVariant,
                  significant,
                  winnerSelectedAt: now.toISOString(),
                  sentToRemainder: sentToRemainder,
                  failedRemainder: failedRemainder,
                },
              }),
            },
          });

          results.push({
            id: campaign.id,
            name: campaign.name,
            winner: winnerVariant,
            significant,
            sentToRemainder,
          });
        } catch (err) {
          logger.error('[AB Test Check] Campaign processing failed', {
            campaignId: campaign.id,
            error: err instanceof Error ? err.message : String(err),
          });
          results.push({
            id: campaign.id,
            name: campaign.name,
            significant: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      logger.info('[CRON:AB-TEST-CHECK] Completed', {
        checked: abCampaigns.length,
        resolved: results.filter(r => r.winner).length,
      });

      return NextResponse.json({
        success: true,
        checked: abCampaigns.length,
        results,
      });
    } catch (error) {
      logger.error('[CRON:AB-TEST-CHECK] Error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export { GET as POST };
