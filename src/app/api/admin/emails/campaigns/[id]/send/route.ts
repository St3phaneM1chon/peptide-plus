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

export const POST = withAdminGuard(
  async (_request: NextRequest, { session, params }: { session: { user: { id: string } }; params: { id: string } }) => {
    try {
      // Atomic status guard: update only if status is sendable (prevents TOCTOU race)
      const { count: updated } = await prisma.emailCampaign.updateMany({
        where: {
          id: params.id,
          status: { in: ['DRAFT', 'SCHEDULED', 'FAILED'] },
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
        // Build orders filter without overwriting: merge hasOrdered + minOrderValue
        if (query.hasOrdered && query.minOrderValue) {
          where.orders = {
            some: { total: { gte: parseFloat(String(query.minOrderValue)) } },
          };
        } else if (query.minOrderValue) {
          where.orders = {
            some: { total: { gte: parseFloat(String(query.minOrderValue)) } },
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

      // Send to each recipient with basic throttle to avoid provider rate limits
      let sent = 0;
      let failed = 0;
      const BATCH_SIZE = 10;
      const BATCH_DELAY_MS = 1000; // 1s pause between batches (~10/s max)

      for (let i = 0; i < validRecipients.length; i++) {
        // Throttle: pause between batches
        if (i > 0 && i % BATCH_SIZE === 0) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
        }
        const recipient = validRecipients[i];
        try {
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
        } catch {
          failed++;
        }
      }

      // Update campaign status and stats
      await prisma.emailCampaign.update({
        where: { id: params.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          stats: JSON.stringify({
            sent,
            failed,
            delivered: 0,
            opened: 0,
            clicked: 0,
            bounced: 0,
            revenue: 0,
            totalRecipients: validRecipients.length,
          }),
        },
      });

      logAdminAction({
        adminUserId: session.user.id,
        action: 'SEND_EMAIL_CAMPAIGN',
        targetType: 'EmailCampaign',
        targetId: params.id,
        newValue: { sent, failed, totalRecipients: validRecipients.length },
        ipAddress: getClientIpFromRequest(_request),
        userAgent: _request.headers.get('user-agent') || undefined,
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        stats: { sent, failed, totalRecipients: validRecipients.length },
      });
    } catch (error) {
      console.error('[Campaign Send] Error:', error);
      // Mark as FAILED (not DRAFT) to prevent duplicate sends on retry
      await prisma.emailCampaign.update({
        where: { id: params.id },
        data: { status: 'FAILED' },
      }).catch(() => {});
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);
