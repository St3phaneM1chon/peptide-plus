export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/emails/campaigns/[id]/send
 * Send a campaign to its segment audience
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { sendEmail } from '@/lib/email/email-service';
import { generateUnsubscribeUrl } from '@/lib/email/unsubscribe';
import { shouldSuppressEmail } from '@/lib/email/bounce-handler';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';

import { escapeHtml } from '@/lib/email/templates/base-template';
import { logger } from '@/lib/logger';

// Frequency cap: skip recipients who received a campaign email within this window
const CAMPAIGN_FREQUENCY_CAP_HOURS = parseInt(process.env.CAMPAIGN_FREQUENCY_CAP_HOURS || '24', 10);

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
      // Also allow resuming PAUSED campaigns
      const { count: updated } = await prisma.emailCampaign.updateMany({
        where: {
          id: params.id,
          status: { in: ['DRAFT', 'SCHEDULED', 'FAILED', 'PAUSED'] },
        },
        data: { status: 'SENDING' },
      });

      if (updated === 0) {
        // Either not found or already sending/sent
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

      // Build audience from segment query
      let recipients: Array<{ email: string; name: string | null; id: string }>;

      if (campaign.segmentQuery) {
        // Faille #37: Reject oversized segmentQuery to prevent JSON injection / DoS
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

        // Faille #38: Validate parseFloat results to prevent Prisma injection via NaN/Infinity/negative
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

        // Build orders filter without overwriting: merge hasOrdered + minOrderValue
        if (query.hasOrdered && parsedMinOrderValue !== null) {
          where.orders = {
            some: { total: { gte: parsedMinOrderValue } },
          };
        } else if (parsedMinOrderValue !== null) {
          where.orders = {
            some: { total: { gte: parsedMinOrderValue } },
          };
        } else if (query.hasOrdered) {
          where.orders = { some: {} };
        }

        recipients = await prisma.user.findMany({
          where: { ...where, emailVerified: { not: null } },
          select: { id: true, email: true, name: true },
        });
      } else {
        // No segment = send to all verified users with newsletter opt-in
        recipients = await prisma.user.findMany({
          where: { emailVerified: { not: null } },
          select: { id: true, email: true, name: true },
        });
      }

      // Filter: bounce-suppressed emails + consent/newsletter opt-in check
      // Batch-fetch notification preferences and consent records to avoid N+1 queries
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
        // Check bounce suppression (returns {suppressed: boolean, reason?: string})
        const { suppressed } = await shouldSuppressEmail(r.email);
        if (suppressed) continue;

        // Check notification preferences
        const prefs = prefsMap.get(r.id);
        // Skip users who explicitly opted out of BOTH newsletter and promotions
        if (prefs && !prefs.newsletter && !prefs.promotions) continue;

        // RGPD compliance: require explicit consent record for marketing emails.
        // Default NotificationPreference values do NOT count as consent.
        const hasConsent = consentEmails.has(r.email.toLowerCase());
        if (!hasConsent) continue;

        validRecipients.push(r);
      }

      // Determine resume offset: if resuming from PAUSED, skip already-sent recipients
      let existingStats: Record<string, unknown> = {};
      if (campaign.stats) {
        try {
          existingStats = JSON.parse(campaign.stats);
        } catch (error) {
          console.error('[EmailCampaignSend] Failed to parse campaign stats JSON:', error);
        }
      }
      const resumeOffset = typeof existingStats.sentCount === 'number' ? existingStats.sentCount : 0;

      // Send to each recipient with basic throttle to avoid provider rate limits
      let sent = 0;
      let failed = 0;
      let paused = false;
      const BATCH_SIZE = 10;
      const BATCH_DELAY_MS = 1000; // 1s pause between batches (~10/s max)
      const totalCount = validRecipients.length;

      for (let i = resumeOffset; i < validRecipients.length; i++) {
        // Throttle: pause between batches + check for pause signal
        if (i > resumeOffset && i % BATCH_SIZE === 0) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));

          // Check if campaign was paused externally (via PUT status=PAUSED)
          const current = await prisma.emailCampaign.findUnique({
            where: { id: params.id },
            select: { status: true },
          });
          if (current?.status === 'PAUSED') {
            paused = true;
            // Save progress so the campaign can resume later
            await prisma.emailCampaign.update({
              where: { id: params.id },
              data: {
                stats: JSON.stringify({
                  ...existingStats,
                  sent: (typeof existingStats.sent === 'number' ? existingStats.sent : 0) + sent,
                  failed: (typeof existingStats.failed === 'number' ? existingStats.failed : 0) + failed,
                  sentCount: resumeOffset + sent + failed, // progress offset for resume
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
            logger.info('[Campaign Send] Paused by admin', {
              campaignId: params.id,
              sentSoFar: resumeOffset + sent,
              totalCount,
            });
            break;
          }
        }
        const recipient = validRecipients[i];
        try {
          // Frequency cap: skip if recipient received a campaign email recently
          if (CAMPAIGN_FREQUENCY_CAP_HOURS > 0) {
            const cutoff = new Date(Date.now() - CAMPAIGN_FREQUENCY_CAP_HOURS * 60 * 60 * 1000);
            const recentCampaign = await prisma.emailLog.findFirst({
              where: {
                to: recipient.email,
                templateId: { startsWith: 'campaign:' },
                sentAt: { gt: cutoff },
              },
              select: { id: true },
            });
            if (recentCampaign) {
              logger.info('[Campaign Send] Frequency cap: skipping recipient', {
                email: recipient.email,
                campaignId: params.id,
                capHours: CAMPAIGN_FREQUENCY_CAP_HOURS,
              });
              continue;
            }
          }

          // Personalize content - HTML-escape user data to prevent XSS
          const safeName = escapeHtml(recipient.name || 'Client');
          const safeEmail = escapeHtml(recipient.email);
          const html = campaign.htmlContent
            .replace(/\{\{prenom\}\}/g, safeName)
            .replace(/\{\{email\}\}/g, safeEmail);
          // Subject is plain text context, no HTML escaping needed
          const subject = campaign.subject
            .replace(/\{\{prenom\}\}/g, recipient.name || 'Client');

          // Generate unsubscribe URL (CAN-SPAM / RGPD / LCAP compliance)
          const unsubscribeUrl = await generateUnsubscribeUrl(recipient.email, 'marketing', recipient.id).catch(() => undefined);

          const result = await sendEmail({
            to: { email: recipient.email, name: recipient.name || undefined },
            subject,
            html,
            text: campaign.textContent || undefined,
            tags: ['campaign', campaign.id],
            unsubscribeUrl,
          });

          if (!result.success) {
            failed++;
            continue;
          }

          // Store messageId for webhook event correlation
          await prisma.emailLog.create({
            data: {
              to: recipient.email,
              subject,
              status: 'sent',
              templateId: `campaign:${campaign.id}`,
              messageId: result.messageId || undefined,
            },
          });

          sent++;
        } catch (error) {
          console.error('[EmailCampaignSend] Failed to send email to recipient:', error);
          failed++;
        }
      }

      // If paused, progress was already saved above; return partial result
      if (paused) {
        logAdminAction({
          adminUserId: session.user.id,
          action: 'PAUSE_EMAIL_CAMPAIGN',
          targetType: 'EmailCampaign',
          targetId: params.id,
          newValue: { sent, failed, paused: true, sentCount: resumeOffset + sent + failed, totalCount },
          ipAddress: getClientIpFromRequest(_request),
          userAgent: _request.headers.get('user-agent') || undefined,
        }).catch(() => {});

        return NextResponse.json({
          success: true,
          paused: true,
          stats: { sent, failed, sentCount: resumeOffset + sent + failed, totalCount },
        });
      }

      // Completed: update campaign status and stats
      const totalSent = (typeof existingStats.sent === 'number' ? existingStats.sent : 0) + sent;
      const totalFailed = (typeof existingStats.failed === 'number' ? existingStats.failed : 0) + failed;

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
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        stats: { sent: totalSent, failed: totalFailed, sentCount: totalCount, totalCount },
      });
    } catch (error) {
      logger.error('[Campaign Send] Error', { error: error instanceof Error ? error.message : String(error) });
      // Mark as FAILED (not DRAFT) to prevent duplicate sends on retry
      await prisma.emailCampaign.update({
        where: { id: params.id },
        data: { status: 'FAILED' },
      }).catch(() => {});
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);
