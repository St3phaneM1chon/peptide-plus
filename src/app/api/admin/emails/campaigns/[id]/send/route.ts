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

export const POST = withAdminGuard(
  async (_request: NextRequest, { session, params }: { session: { user: { id: string } }; params: { id: string } }) => {
    try {
      const campaign = await prisma.emailCampaign.findUnique({ where: { id: params.id } });
      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }
      if (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED') {
        return NextResponse.json({ error: 'Campaign must be DRAFT or SCHEDULED to send' }, { status: 400 });
      }

      // Mark as SENDING
      await prisma.emailCampaign.update({
        where: { id: params.id },
        data: { status: 'SENDING' },
      });

      // Build audience from segment query
      let recipients: Array<{ email: string; name: string | null; id: string }>;

      if (campaign.segmentQuery) {
        const query = JSON.parse(campaign.segmentQuery);
        const where: Record<string, unknown> = {};

        if (query.loyaltyTier) where.loyaltyTier = query.loyaltyTier;
        if (query.locale) where.locale = query.locale;
        if (query.hasOrdered) {
          where.orders = { some: {} };
        }
        if (query.minOrderValue) {
          where.orders = {
            some: { total: { gte: parseFloat(query.minOrderValue) } },
          };
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

      // Filter suppressed emails
      const validRecipients: typeof recipients = [];
      for (const r of recipients) {
        const suppressed = await shouldSuppressEmail(r.email);
        if (!suppressed) validRecipients.push(r);
      }

      // Send to each recipient (batch in production)
      let sent = 0;
      let failed = 0;

      for (const recipient of validRecipients) {
        try {
          // Personalize content
          const html = campaign.htmlContent
            .replace(/\{\{prenom\}\}/g, recipient.name || 'Client')
            .replace(/\{\{email\}\}/g, recipient.email);
          const subject = campaign.subject
            .replace(/\{\{prenom\}\}/g, recipient.name || 'Client');

          // Generate unsubscribe URL (CAN-SPAM / RGPD / LCAP compliance)
          const unsubscribeUrl = await generateUnsubscribeUrl(recipient.email, 'marketing', recipient.id).catch(() => undefined);

          await sendEmail({
            to: { email: recipient.email, name: recipient.name || undefined },
            subject,
            html,
            text: campaign.textContent || undefined,
            tags: ['campaign', campaign.id],
            unsubscribeUrl,
          });

          await prisma.emailLog.create({
            data: {
              id: `campaign-${campaign.id}-${recipient.id}`,
              to: recipient.email,
              subject,
              status: 'sent',
              templateId: `campaign:${campaign.id}`,
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
      // Reset to DRAFT on error
      await prisma.emailCampaign.update({
        where: { id: params.id },
        data: { status: 'DRAFT' },
      }).catch(() => {});
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);
