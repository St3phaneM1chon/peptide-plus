export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/emails/campaigns/[id]/send
 * Send a campaign to its segment audience.
 *
 * Features:
 * - Email tracking (open pixel + click wrapping) for all marketing emails
 * - A/B testing: if abTestConfig is set, splits audience into variants
 * - Pause/resume support with progress offset
 * - Frequency cap, bounce suppression, RGPD consent checks
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { sendEmail } from '@/lib/email/email-service';
import { generateUnsubscribeUrl } from '@/lib/email/unsubscribe';
import { shouldSuppressEmail } from '@/lib/email/bounce-handler';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import type { ABTest, ABTestVariant } from '@/lib/email/ab-test-engine';
import { escapeHtml } from '@/lib/email/templates/base-template';
import { logger } from '@/lib/logger';

// Frequency cap: skip recipients who received a campaign email within this window
const CAMPAIGN_FREQUENCY_CAP_HOURS = parseInt(process.env.CAMPAIGN_FREQUENCY_CAP_HOURS || '24', 10);

// ---------------------------------------------------------------------------
// A/B Test Config types (stored in campaign.abTestConfig JSON)
// ---------------------------------------------------------------------------

interface ABTestConfig {
  enabled: boolean;
  testType: 'subject' | 'content'; // What differs between variants
  variantA: { subject?: string; htmlContent?: string };
  variantB: { subject?: string; htmlContent?: string };
  splitPercentage: number;         // % of total audience for the test (e.g., 20 = 10% A + 10% B)
  waitDurationMinutes: number;     // Minutes to wait before checking winner (e.g., 120 = 2h)
  winningMetric: 'open_rate' | 'click_rate' | 'conversion_rate';
  confidenceLevel?: number;        // 0.90, 0.95, 0.99 (default 0.95)
}

// ---------------------------------------------------------------------------
// Helper: send a batch of emails to recipients
// ---------------------------------------------------------------------------

interface SendBatchOptions {
  recipients: Array<{ email: string; name: string | null; id: string }>;
  campaign: {
    id: string;
    subject: string;
    htmlContent: string;
    textContent: string | null;
  };
  frequencyCapEmails: Set<string>;
  abVariant?: string; // "A" or "B" for A/B test tracking
  startOffset: number;
  existingStats: Record<string, unknown>;
  campaignId: string;
}

async function sendBatch(opts: SendBatchOptions): Promise<{ sent: number; failed: number; paused: boolean }> {
  let sent = 0;
  let failed = 0;
  let paused = false;
  const BATCH_SIZE = 10;
  const BATCH_DELAY_MS = 1000;

  for (let i = opts.startOffset; i < opts.recipients.length; i++) {
    // Throttle: pause between batches + check for pause signal
    if (i > opts.startOffset && i % BATCH_SIZE === 0) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));

      // Check if campaign was paused externally
      const current = await prisma.emailCampaign.findUnique({
        where: { id: opts.campaignId },
        select: { status: true },
      });
      if (current?.status === 'PAUSED') {
        paused = true;
        break;
      }
    }

    const recipient = opts.recipients[i];
    try {
      // Frequency cap
      if (CAMPAIGN_FREQUENCY_CAP_HOURS > 0 && opts.frequencyCapEmails.has(recipient.email)) {
        logger.info('[Campaign Send] Frequency cap: skipping recipient', {
          email: recipient.email,
          campaignId: opts.campaignId,
        });
        continue;
      }

      // Personalize content - HTML-escape user data to prevent XSS
      const safeName = escapeHtml(recipient.name || 'Client');
      const safeEmail = escapeHtml(recipient.email);
      const html = opts.campaign.htmlContent
        .replace(/\{\{prenom\}\}/g, safeName)
        .replace(/\{\{email\}\}/g, safeEmail);
      const subject = opts.campaign.subject
        .replace(/\{\{prenom\}\}/g, recipient.name || 'Client');

      // Generate unsubscribe URL (CAN-SPAM / RGPD / LCAP compliance)
      const unsubscribeUrl = await generateUnsubscribeUrl(recipient.email, 'marketing', recipient.id).catch((err) => {
        logger.warn('[EmailCampaignSend] Failed to generate unsubscribe URL', {
          email: recipient.email,
          campaignId: opts.campaignId,
          error: err instanceof Error ? err.message : String(err),
        });
        return undefined;
      });

      // Create EmailLog FIRST to get the ID for tracking pixel injection
      const emailLog = await prisma.emailLog.create({
        data: {
          to: recipient.email,
          subject,
          status: 'sending',
          templateId: `campaign:${opts.campaign.id}`,
          abVariant: opts.abVariant || null,
        },
      });

      const result = await sendEmail({
        to: { email: recipient.email, name: recipient.name || undefined },
        subject,
        html,
        text: opts.campaign.textContent || undefined,
        tags: ['campaign', opts.campaign.id],
        unsubscribeUrl,
        emailType: 'marketing',
        emailLogId: emailLog.id,
      });

      if (!result.success) {
        await prisma.emailLog.update({
          where: { id: emailLog.id },
          data: { status: 'failed', error: result.error || 'Send failed' },
        });
        failed++;
        continue;
      }

      // Update EmailLog with messageId and sent status
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: 'sent',
          messageId: result.messageId || undefined,
        },
      });

      sent++;
    } catch (error) {
      logger.error('[EmailCampaignSend] Failed to send email to recipient', {
        email: recipient.email,
        campaignId: opts.campaignId,
        error: error instanceof Error ? error.message : String(error),
      });
      failed++;
    }
  }

  return { sent, failed, paused };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(
  async (_request: NextRequest, { session, params }: { session: { user: { id: string } }; params: { id: string } }) => {
    try {
      // Idempotency check: prevent duplicate sends if campaign is already SENT or SENDING
      const existing = await prisma.emailCampaign.findUnique({
        where: { id: params.id },
        select: { status: true },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }
      if (existing.status === 'SENT') {
        return NextResponse.json(
          { error: 'Campaign has already been sent', idempotent: true },
          { status: 409 }
        );
      }
      if (existing.status === 'SENDING') {
        return NextResponse.json(
          { error: 'Campaign is currently being sent', idempotent: true },
          { status: 409 }
        );
      }

      // Atomic status guard: update only if status is sendable (prevents TOCTOU race)
      const { count: updated } = await prisma.emailCampaign.updateMany({
        where: {
          id: params.id,
          status: { in: ['DRAFT', 'SCHEDULED', 'FAILED', 'PAUSED'] },
        },
        data: { status: 'SENDING' },
      });

      if (updated === 0) {
        const exists = await prisma.emailCampaign.findUnique({
          where: { id: params.id },
          select: { status: true },
        });
        if (!exists) {
          return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }
        return NextResponse.json({ error: `Campaign is already ${exists.status}` }, { status: 400 });
      }

      const campaign = await prisma.emailCampaign.findUnique({ where: { id: params.id } });
      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }

      // ── Parse A/B test config ──────────────────────────────────
      let abTestConfig: ABTestConfig | null = null;
      if (campaign.abTestConfig) {
        try {
          const parsed = JSON.parse(campaign.abTestConfig);
          if (parsed && parsed.enabled) {
            abTestConfig = parsed as ABTestConfig;
          }
        } catch (err) {
          logger.warn('[Campaign Send] Invalid abTestConfig JSON, sending without A/B test', {
            campaignId: params.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // ── Build audience ─────────────────────────────────────────
      let recipients: Array<{ email: string; name: string | null; id: string }>;

      if (campaign.segmentQuery) {
        if (campaign.segmentQuery.length > 10000) {
          await prisma.emailCampaign.update({
            where: { id: params.id },
            data: { status: 'FAILED' },
          });
          return NextResponse.json({ error: 'segmentQuery too large (max 10KB)' }, { status: 400 });
        }

        let query: Record<string, unknown>;
        try {
          query = JSON.parse(campaign.segmentQuery);
        } catch {
          await prisma.emailCampaign.update({
            where: { id: params.id },
            data: { status: 'FAILED' },
          });
          return NextResponse.json({ error: 'Invalid segmentQuery JSON' }, { status: 400 });
        }

        const where: Record<string, unknown> = {};
        if (query.loyaltyTier) where.loyaltyTier = query.loyaltyTier;
        if (query.locale) where.locale = query.locale;

        let parsedMinOrderValue: number | null = null;
        if (query.minOrderValue !== undefined && query.minOrderValue !== null) {
          parsedMinOrderValue = parseFloat(String(query.minOrderValue));
          if (!Number.isFinite(parsedMinOrderValue) || parsedMinOrderValue < 0) {
            await prisma.emailCampaign.update({
              where: { id: params.id },
              data: { status: 'FAILED' },
            });
            return NextResponse.json(
              { error: 'Invalid minOrderValue: must be a finite non-negative number' },
              { status: 400 },
            );
          }
        }

        if (query.hasOrdered && parsedMinOrderValue !== null) {
          where.orders = { some: { total: { gte: parsedMinOrderValue } } };
        } else if (parsedMinOrderValue !== null) {
          where.orders = { some: { total: { gte: parsedMinOrderValue } } };
        } else if (query.hasOrdered) {
          where.orders = { some: {} };
        }

        recipients = await prisma.user.findMany({
          where: { ...where, emailVerified: { not: null } },
          select: { id: true, email: true, name: true },
        });
      } else {
        recipients = await prisma.user.findMany({
          where: { emailVerified: { not: null } },
          select: { id: true, email: true, name: true },
        });
      }

      // ── Filter: bounce suppression + consent checks ────────────
      const userIds = recipients.map(r => r.id);
      const userEmails = recipients.map(r => r.email);

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
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
          select: { email: true },
        }),
      ]);

      const prefsMap = new Map(allPrefs.map(p => [p.userId, p]));
      const consentEmails = new Set(allConsents.map(c => c.email.toLowerCase()));

      const validRecipients: typeof recipients = [];
      for (const r of recipients) {
        const { suppressed } = await shouldSuppressEmail(r.email);
        if (suppressed) continue;
        const prefs = prefsMap.get(r.id);
        if (prefs && !prefs.newsletter && !prefs.promotions) continue;
        const hasConsent = consentEmails.has(r.email.toLowerCase());
        if (!hasConsent) continue;
        validRecipients.push(r);
      }

      // ── Parse existing stats for resume ────────────────────────
      let existingStats: Record<string, unknown> = {};
      if (campaign.stats) {
        try {
          existingStats = JSON.parse(campaign.stats);
        } catch (error) {
          logger.warn('[EmailCampaignSend] Failed to parse campaign stats JSON', {
            campaignId: params.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      const resumeOffset = typeof existingStats.sentCount === 'number' ? existingStats.sentCount : 0;

      // ── Frequency cap pre-fetch ────────────────────────────────
      let frequencyCapEmails = new Set<string>();
      if (CAMPAIGN_FREQUENCY_CAP_HOURS > 0 && validRecipients.length > 0) {
        const cutoff = new Date(Date.now() - CAMPAIGN_FREQUENCY_CAP_HOURS * 60 * 60 * 1000);
        const recentCampaignLogs = await prisma.emailLog.findMany({
          where: {
            to: { in: validRecipients.map(r => r.email) },
            templateId: { startsWith: 'campaign:' },
            sentAt: { gt: cutoff },
          },
          select: { to: true },
        });
        frequencyCapEmails = new Set(recentCampaignLogs.map(l => l.to));
      }

      const totalCount = validRecipients.length;

      // ══════════════════════════════════════════════════════════
      // A/B TEST FLOW
      // ══════════════════════════════════════════════════════════
      if (abTestConfig) {
        // Split percentage: e.g., 20 means 10% to A, 10% to B, 80% held back
        const testPoolSize = Math.floor(totalCount * (abTestConfig.splitPercentage / 100));
        const halfPool = Math.floor(testPoolSize / 2);
        const remainderStart = testPoolSize;

        // Shuffle recipients for random assignment
        const shuffled = [...validRecipients].sort(() => Math.random() - 0.5);
        const groupA = shuffled.slice(0, halfPool);
        const groupB = shuffled.slice(halfPool, testPoolSize);
        const groupRemainder = shuffled.slice(remainderStart);

        // Determine variant content
        const variantACampaign = {
          id: campaign.id,
          subject: abTestConfig.variantA.subject || campaign.subject,
          htmlContent: abTestConfig.variantA.htmlContent || campaign.htmlContent,
          textContent: campaign.textContent,
        };
        const variantBCampaign = {
          id: campaign.id,
          subject: abTestConfig.variantB.subject || campaign.subject,
          htmlContent: abTestConfig.variantB.htmlContent || campaign.htmlContent,
          textContent: campaign.textContent,
        };

        // Send variant A
        logger.info('[Campaign Send] A/B Test: sending variant A', {
          campaignId: params.id,
          recipientCount: groupA.length,
        });
        const resultA = await sendBatch({
          recipients: groupA,
          campaign: variantACampaign,
          frequencyCapEmails,
          abVariant: 'A',
          startOffset: 0,
          existingStats,
          campaignId: params.id,
        });

        // Send variant B
        logger.info('[Campaign Send] A/B Test: sending variant B', {
          campaignId: params.id,
          recipientCount: groupB.length,
        });
        const resultB = await sendBatch({
          recipients: groupB,
          campaign: variantBCampaign,
          frequencyCapEmails,
          abVariant: 'B',
          startOffset: 0,
          existingStats,
          campaignId: params.id,
        });

        // Store A/B test state in campaign stats
        const abTestState = {
          status: 'RUNNING' as const,
          variantA: {
            id: 'A',
            name: 'Variant A',
            subject: variantACampaign.subject,
            sent: resultA.sent,
            failed: resultA.failed,
            opens: 0,
            clicks: 0,
            conversions: 0,
            percentage: abTestConfig.splitPercentage / 2,
          },
          variantB: {
            id: 'B',
            name: 'Variant B',
            subject: variantBCampaign.subject,
            sent: resultB.sent,
            failed: resultB.failed,
            opens: 0,
            clicks: 0,
            conversions: 0,
            percentage: abTestConfig.splitPercentage / 2,
          },
          remainderCount: groupRemainder.length,
          winningMetric: abTestConfig.winningMetric,
          confidenceLevel: abTestConfig.confidenceLevel || 0.95,
          waitDurationMinutes: abTestConfig.waitDurationMinutes,
          testStartedAt: new Date().toISOString(),
          checkWinnerAfter: new Date(Date.now() + abTestConfig.waitDurationMinutes * 60 * 1000).toISOString(),
        };

        const totalSent = resultA.sent + resultB.sent;
        const totalFailed = resultA.failed + resultB.failed;

        await prisma.emailCampaign.update({
          where: { id: params.id },
          data: {
            status: 'AB_TESTING',
            sentAt: new Date(),
            stats: JSON.stringify({
              ...existingStats,
              sent: totalSent,
              failed: totalFailed,
              delivered: existingStats.delivered ?? 0,
              opened: existingStats.opened ?? 0,
              clicked: existingStats.clicked ?? 0,
              bounced: existingStats.bounced ?? 0,
              revenue: existingStats.revenue ?? 0,
              totalRecipients: totalCount,
              sentCount: testPoolSize,
              totalCount,
              abTest: abTestState,
            }),
          },
        });

        logAdminAction({
          adminUserId: session.user.id,
          action: 'SEND_AB_TEST_CAMPAIGN',
          targetType: 'EmailCampaign',
          targetId: params.id,
          newValue: {
            sent: totalSent,
            failed: totalFailed,
            testPoolSize,
            remainderCount: groupRemainder.length,
            waitMinutes: abTestConfig.waitDurationMinutes,
          },
          ipAddress: getClientIpFromRequest(_request),
          userAgent: _request.headers.get('user-agent') || undefined,
        }).catch((auditErr) => {
          logger.warn('[EmailCampaignSend] Non-blocking audit log failure on AB_TEST', {
            campaignId: params.id,
            error: auditErr instanceof Error ? auditErr.message : String(auditErr),
          });
        });

        return NextResponse.json({
          success: true,
          abTest: true,
          stats: {
            variantA: { sent: resultA.sent, failed: resultA.failed },
            variantB: { sent: resultB.sent, failed: resultB.failed },
            remainderHeldBack: groupRemainder.length,
            checkWinnerAfter: abTestState.checkWinnerAfter,
          },
        });
      }

      // ══════════════════════════════════════════════════════════
      // STANDARD (NON-A/B) SEND FLOW
      // ══════════════════════════════════════════════════════════

      const result = await sendBatch({
        recipients: validRecipients,
        campaign: {
          id: campaign.id,
          subject: campaign.subject,
          htmlContent: campaign.htmlContent,
          textContent: campaign.textContent,
        },
        frequencyCapEmails,
        startOffset: resumeOffset,
        existingStats,
        campaignId: params.id,
      });

      // If paused, save progress
      if (result.paused) {
        await prisma.emailCampaign.update({
          where: { id: params.id },
          data: {
            status: 'PAUSED',
            stats: JSON.stringify({
              ...existingStats,
              sent: (typeof existingStats.sent === 'number' ? existingStats.sent : 0) + result.sent,
              failed: (typeof existingStats.failed === 'number' ? existingStats.failed : 0) + result.failed,
              sentCount: resumeOffset + result.sent + result.failed,
              totalCount,
              delivered: existingStats.delivered ?? 0,
              opened: existingStats.opened ?? 0,
              clicked: existingStats.clicked ?? 0,
              bounced: existingStats.bounced ?? 0,
              revenue: existingStats.revenue ?? 0,
              totalRecipients: totalCount,
              pausedAt: new Date().toISOString(),
            }),
          },
        });

        logAdminAction({
          adminUserId: session.user.id,
          action: 'PAUSE_EMAIL_CAMPAIGN',
          targetType: 'EmailCampaign',
          targetId: params.id,
          newValue: { sent: result.sent, failed: result.failed, paused: true, sentCount: resumeOffset + result.sent + result.failed, totalCount },
          ipAddress: getClientIpFromRequest(_request),
          userAgent: _request.headers.get('user-agent') || undefined,
        }).catch((auditErr) => {
          logger.warn('[EmailCampaignSend] Non-blocking audit log failure on PAUSE', {
            campaignId: params.id,
            error: auditErr instanceof Error ? auditErr.message : String(auditErr),
          });
        });

        return NextResponse.json({
          success: true,
          paused: true,
          stats: { sent: result.sent, failed: result.failed, sentCount: resumeOffset + result.sent + result.failed, totalCount },
        });
      }

      // Completed: update campaign status and stats
      const totalSent = (typeof existingStats.sent === 'number' ? existingStats.sent : 0) + result.sent;
      const totalFailed = (typeof existingStats.failed === 'number' ? existingStats.failed : 0) + result.failed;

      await prisma.emailCampaign.update({
        where: { id: params.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          stats: JSON.stringify({
            sent: totalSent,
            failed: totalFailed,
            delivered: existingStats.delivered ?? 0,
            opened: existingStats.opened ?? 0,
            clicked: existingStats.clicked ?? 0,
            bounced: existingStats.bounced ?? 0,
            revenue: existingStats.revenue ?? 0,
            totalRecipients: totalCount,
            sentCount: totalCount,
            totalCount,
          }),
        },
      });

      logAdminAction({
        adminUserId: session.user.id,
        action: 'SEND_EMAIL_CAMPAIGN',
        targetType: 'EmailCampaign',
        targetId: params.id,
        newValue: { sent: totalSent, failed: totalFailed, totalRecipients: totalCount },
        ipAddress: getClientIpFromRequest(_request),
        userAgent: _request.headers.get('user-agent') || undefined,
      }).catch((auditErr) => {
        logger.warn('[EmailCampaignSend] Non-blocking audit log failure on SEND', {
          campaignId: params.id,
          error: auditErr instanceof Error ? auditErr.message : String(auditErr),
        });
      });

      return NextResponse.json({
        success: true,
        stats: { sent: totalSent, failed: totalFailed, sentCount: totalCount, totalCount },
      });
    } catch (error) {
      logger.error('[Campaign Send] Error', { error: error instanceof Error ? error.message : String(error) });
      await prisma.emailCampaign.update({
        where: { id: params.id },
        data: { status: 'FAILED' },
      }).catch((updateErr) => {
        logger.error('[EmailCampaignSend] Failed to mark campaign as FAILED after error', {
          campaignId: params.id,
          error: updateErr instanceof Error ? updateErr.message : String(updateErr),
        });
      });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);
