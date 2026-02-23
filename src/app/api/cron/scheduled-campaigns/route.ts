export const dynamic = 'force-dynamic';

/**
 * CRON - Execute scheduled campaigns
 * GET /api/cron/scheduled-campaigns
 *
 * Finds campaigns with status='SCHEDULED' and scheduledAt <= now,
 * then triggers their send via direct campaign send logic (not HTTP).
 *
 * Configuration Vercel (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/scheduled-campaigns",
 *     "schedule": "0/5 * * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/email-service';
import { generateUnsubscribeUrl } from '@/lib/email/unsubscribe';
import { shouldSuppressEmail } from '@/lib/email/bounce-handler';
import { escapeHtml } from '@/lib/email/templates/base-template';
import { withJobLock } from '@/lib/cron-lock';

export async function GET(request: NextRequest) {
  // FLAW-007 FIX: Only accept cron secret via Authorization header, not query string.
  // Query string secrets appear in server logs, browser history, CDN logs, and Referer headers.
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return withJobLock('scheduled-campaigns', async () => {
  try {
    const now = new Date();

    // Find campaigns ready to send (atomic status guard)
    const scheduledCampaigns = await prisma.emailCampaign.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: now },
      },
      take: 10,
    });

    if (scheduledCampaigns.length === 0) {
      return NextResponse.json({ success: true, triggered: 0 });
    }

    const results: Array<{ id: string; name: string; success: boolean; sent?: number; failed?: number; error?: string }> = [];

    for (const campaign of scheduledCampaigns) {
      try {
        // Atomic status guard: only process if still SCHEDULED
        const { count: claimed } = await prisma.emailCampaign.updateMany({
          where: { id: campaign.id, status: 'SCHEDULED' },
          data: { status: 'SENDING' },
        });
        if (claimed === 0) {
          results.push({ id: campaign.id, name: campaign.name, success: false, error: 'Already claimed' });
          continue;
        }

        // Build audience
        let recipients: Array<{ email: string; name: string | null; id: string }>;

        if (campaign.segmentQuery) {
          let query: Record<string, unknown>;
          try {
            query = JSON.parse(campaign.segmentQuery);
          } catch {
            await prisma.emailCampaign.update({ where: { id: campaign.id }, data: { status: 'FAILED' } });
            results.push({ id: campaign.id, name: campaign.name, success: false, error: 'Invalid segmentQuery' });
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

          // FLAW-036 FIX: Paginate audience query to avoid loading ALL users into memory
          recipients = [];
          let cursor: string | undefined;
          const PAGE_SIZE = 500;
          while (true) {
            const batch = await prisma.user.findMany({
              where: { ...where, emailVerified: { not: null } },
              select: { id: true, email: true, name: true },
              take: PAGE_SIZE,
              ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
              orderBy: { id: 'asc' },
            });
            recipients.push(...batch);
            if (batch.length < PAGE_SIZE) break;
            cursor = batch[batch.length - 1].id;
          }
        } else {
          recipients = [];
          let cursor: string | undefined;
          const PAGE_SIZE = 500;
          while (true) {
            const batch = await prisma.user.findMany({
              where: { emailVerified: { not: null } },
              select: { id: true, email: true, name: true },
              take: PAGE_SIZE,
              ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
              orderBy: { id: 'asc' },
            });
            recipients.push(...batch);
            if (batch.length < PAGE_SIZE) break;
            cursor = batch[batch.length - 1].id;
          }
        }

        // Batch-fetch consent and prefs
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
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
            select: { email: true },
          }),
        ]);

        const prefsMap = new Map(allPrefs.map(p => [p.userId, p]));
        const consentEmails = new Set(allConsents.map(c => c.email.toLowerCase()));

        // FLAW-037 FIX: Batch bounce check instead of sequential per-user
        // First apply non-async filters
        const preFilteredRecipients = recipients.filter(r => {
          const prefs = prefsMap.get(r.id);
          if (prefs && !prefs.newsletter && !prefs.promotions) return false;
          if (!consentEmails.has(r.email.toLowerCase())) return false;
          return true;
        });

        // Then check bounce suppression in parallel batches of 50
        const validRecipients: typeof recipients = [];
        const BOUNCE_BATCH_SIZE = 50;
        for (let b = 0; b < preFilteredRecipients.length; b += BOUNCE_BATCH_SIZE) {
          const batch = preFilteredRecipients.slice(b, b + BOUNCE_BATCH_SIZE);
          const results = await Promise.all(
            batch.map(r => shouldSuppressEmail(r.email).then(res => ({ r, suppressed: res.suppressed })))
          );
          for (const { r, suppressed } of results) {
            if (!suppressed) validRecipients.push(r);
          }
        }

        // Send to each recipient with throttle to avoid provider rate limits
        let sent = 0;
        let failed = 0;

        for (let i = 0; i < validRecipients.length; i++) {
          if (i > 0 && i % 10 === 0) await new Promise(r => setTimeout(r, 1000));
          const recipient = validRecipients[i];
          try {
            const safeName = escapeHtml(recipient.name || 'Client');
            const safeEmail = escapeHtml(recipient.email);
            const html = campaign.htmlContent
              .replace(/\{\{prenom\}\}/g, safeName)
              .replace(/\{\{email\}\}/g, safeEmail);
            const subject = campaign.subject
              .replace(/\{\{prenom\}\}/g, recipient.name || 'Client');

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
          where: { id: campaign.id },
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

        results.push({ id: campaign.id, name: campaign.name, success: true, sent, failed });
      } catch (err) {
        results.push({
          id: campaign.id,
          name: campaign.name,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        await prisma.emailCampaign.update({
          where: { id: campaign.id },
          data: { status: 'FAILED' },
        }).catch(() => {});
      }
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(`[CRON:SCHEDULED-CAMPAIGNS] Triggered ${successCount}/${scheduledCampaigns.length} campaigns`);

    return NextResponse.json({
      success: true,
      triggered: successCount,
      failed: results.length - successCount,
      results,
    });
  } catch (error) {
    console.error('[CRON:SCHEDULED-CAMPAIGNS] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
  });
}

export { GET as POST };
