export const dynamic = 'force-dynamic';

/**
 * Admin Email Campaign Detail API
 * GET    - Get campaign detail
 * PUT    - Update campaign
 * DELETE - Delete campaign (only DRAFT)
 *
 * CSRF Mitigation (#30): These endpoints are protected by Next.js 15 defaults:
 * - SameSite=Lax cookies prevent cross-origin form submissions from attaching session cookies.
 * - The withAdminGuard middleware verifies server-side session authentication.
 * - All mutating endpoints (PUT, DELETE) require JSON Content-Type, which triggers
 *   a CORS preflight for cross-origin requests, providing additional protection.
 * No additional CSRF token is needed given these layered defenses.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { safeParseJson } from '@/lib/email/utils';
import { logger } from '@/lib/logger';

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  subject: z.string().min(1).max(500).optional(),
  htmlContent: z.string().min(1).optional(),
  textContent: z.string().nullable().optional(),
  segmentQuery: z.unknown().optional(),
  scheduledAt: z.string().nullable().optional(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'SENDING', 'PAUSED']).optional(),
  abTestConfig: z.unknown().optional(),
  timezone: z.string().max(50).nullable().optional(),
});

/** Valid status transitions for campaigns */
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SCHEDULED'],
  SCHEDULED: ['DRAFT'],
  SENDING: ['PAUSED'],
  PAUSED: ['SENDING'],
};

/** Validate an IANA timezone string (basic check) */
function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch (error) {
    console.error('[EmailCampaigns] Invalid timezone validation:', error);
    return false;
  }
}

export const GET = withAdminGuard(
  async (request: NextRequest, { session: _session, params }: { session: unknown; params: { id: string } }) => {
    try {
      const campaign = await prisma.emailCampaign.findUnique({ where: { id: params.id } });
      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }

      const url = new URL(request.url);
      const include = url.searchParams.get('include');
      const preview = url.searchParams.get('preview');

      // Per-recipient engagement stats: query EmailLog for this campaign's emails
      if (include === 'recipientStats') {
        // Campaign emails are tracked via subject match + date range (no FK to campaign)
        const sentAfter = campaign.sentAt || campaign.createdAt;
        const logWhere = {
          subject: campaign.subject,
          sentAt: { gte: sentAfter },
        };

        const [total, delivered, opened, clicked, bounced, failed] = await Promise.all([
          prisma.emailLog.count({ where: { ...logWhere, status: 'sent' } }),
          prisma.emailLog.count({ where: { ...logWhere, status: 'delivered' } }),
          prisma.emailLog.count({ where: { ...logWhere, status: 'opened' } }),
          prisma.emailLog.count({ where: { ...logWhere, status: 'clicked' } }),
          prisma.emailLog.count({ where: { ...logWhere, status: 'bounced' } }),
          prisma.emailLog.count({ where: { ...logWhere, status: 'failed' } }),
        ]);

        // List bounced recipients for follow-up
        const bouncedRecipients = await prisma.emailLog.findMany({
          where: { ...logWhere, status: 'bounced' },
          select: { to: true, error: true, sentAt: true },
          orderBy: { sentAt: 'desc' },
          take: 100,
        });

        return NextResponse.json({
          campaignId: campaign.id,
          campaignName: campaign.name,
          recipientStats: {
            totalSent: total + delivered,
            delivered,
            opened,
            clicked,
            bounced,
            failed,
            openRate: (total + delivered) > 0
              ? parseFloat(((opened / (total + delivered)) * 100).toFixed(1))
              : 0,
            clickRate: opened > 0
              ? parseFloat(((clicked / opened) * 100).toFixed(1))
              : 0,
            bounceRate: (total + delivered + bounced + failed) > 0
              ? parseFloat(((bounced / (total + delivered + bounced + failed)) * 100).toFixed(1))
              : 0,
          },
          bouncedRecipients: bouncedRecipients.map(r => ({
            email: r.to,
            error: r.error,
            bouncedAt: r.sentAt,
          })),
        });
      }

      // Recipient preview: return a sample of 10 matching subscribers without sending
      if (preview === 'recipients') {
        const segmentQuery = safeParseJson<Record<string, unknown>>(campaign.segmentQuery);
        const subscriberWhere: Record<string, unknown> = { isActive: true };

        if (segmentQuery) {
          if (segmentQuery.locale && typeof segmentQuery.locale === 'string') {
            subscriberWhere.locale = segmentQuery.locale;
          }
          if (segmentQuery.source && typeof segmentQuery.source === 'string') {
            subscriberWhere.source = segmentQuery.source;
          }
        }

        const recipients = await prisma.newsletterSubscriber.findMany({
          where: subscriberWhere,
          take: 10,
          orderBy: { subscribedAt: 'desc' },
          select: { email: true, name: true, locale: true },
        });

        const totalMatching = await prisma.newsletterSubscriber.count({ where: subscriberWhere });

        return NextResponse.json({
          campaignId: campaign.id,
          campaignName: campaign.name,
          segmentQuery: safeParseJson(campaign.segmentQuery, null),
          preview: {
            sampleRecipients: recipients,
            sampleSize: recipients.length,
            totalMatching,
          },
        });
      }

      const parsedStats = safeParseJson<Record<string, unknown> | null>(campaign.stats, null);
      const timezone = parsedStats?.timezone as string | undefined;

      return NextResponse.json({
        campaign: {
          ...campaign,
          stats: parsedStats,
          segmentQuery: safeParseJson(campaign.segmentQuery, null),
          abTestConfig: safeParseJson(campaign.abTestConfig, null),
          timezone: timezone || null,
        },
      });
    } catch (error) {
      logger.error('[Campaign Detail] Error', { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);

export const PUT = withAdminGuard(
  async (request: NextRequest, { session, params }: { session: { user: { id: string } }; params: { id: string } }) => {
    try {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip') || '127.0.0.1';
      const rl = await rateLimitMiddleware(ip, '/api/admin/emails/campaigns/[id]');
      if (!rl.success) {
        const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
        Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
        return res;
      }
      const csrfValid = await validateCsrf(request);
      if (!csrfValid) {
        return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
      }

      const body = await request.json();
      const parsed = updateCampaignSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
      }
      const { name, subject, htmlContent, textContent, segmentQuery, scheduledAt, status, abTestConfig, timezone } = parsed.data;

      const existing = await prisma.emailCampaign.findUnique({ where: { id: params.id } });
      if (!existing) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }

      // Validate status transitions
      if (status !== undefined && status !== existing.status) {
        const allowed = VALID_STATUS_TRANSITIONS[existing.status];
        if (!allowed || !allowed.includes(status)) {
          return NextResponse.json(
            { error: `Invalid status transition: ${existing.status} -> ${status}` },
            { status: 400 },
          );
        }
      }

      // For pause/resume, only status change is allowed (no content edits)
      const isPauseResume = status !== undefined &&
        ((existing.status === 'SENDING' && status === 'PAUSED') ||
         (existing.status === 'PAUSED' && status === 'SENDING'));

      // Don't allow editing content of sent/sending/paused campaigns (except pause/resume)
      if (!isPauseResume && (existing.status === 'SENT' || existing.status === 'SENDING' || existing.status === 'PAUSED')) {
        return NextResponse.json({ error: 'Cannot edit a sent, sending, or paused campaign' }, { status: 400 });
      }

      // Security: Reject oversized segmentQuery to prevent JSON injection / DoS
      if (segmentQuery !== undefined && segmentQuery !== null) {
        if (JSON.stringify(segmentQuery).length > 10000) {
          return NextResponse.json({ error: 'segmentQuery too large (max 10KB)' }, { status: 400 });
        }
      }

      // Validate timezone if provided
      if (timezone !== undefined && timezone !== null && typeof timezone === 'string' && timezone.length > 0) {
        if (!isValidTimezone(timezone)) {
          return NextResponse.json({ error: `Invalid timezone: ${timezone}` }, { status: 400 });
        }
      }

      // Validate scheduledAt: must be at least 5 minutes in the future
      if (scheduledAt !== undefined && scheduledAt !== null) {
        const scheduledDate = new Date(scheduledAt);
        if (isNaN(scheduledDate.getTime())) {
          return NextResponse.json({ error: 'Invalid scheduledAt date' }, { status: 400 });
        }
        const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
        if (scheduledDate < fiveMinutesFromNow) {
          return NextResponse.json(
            { error: 'scheduledAt must be at least 5 minutes in the future' },
            { status: 400 },
          );
        }
      }

      const updates: Record<string, unknown> = {};
      if (isPauseResume) {
        // Pause/resume: only update status
        updates.status = status;
      } else {
        if (name !== undefined) updates.name = name;
        if (subject !== undefined) updates.subject = subject;
        if (htmlContent !== undefined) updates.htmlContent = htmlContent;
        if (textContent !== undefined) updates.textContent = textContent;
        if (segmentQuery !== undefined) updates.segmentQuery = segmentQuery ? JSON.stringify(segmentQuery) : null;
        if (scheduledAt !== undefined) updates.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
        if (status !== undefined) updates.status = status;
        if (abTestConfig !== undefined) updates.abTestConfig = abTestConfig ? JSON.stringify(abTestConfig) : null;

        // Auto-update status based on scheduledAt changes (only for DRAFT/SCHEDULED campaigns)
        if (scheduledAt !== undefined && status === undefined) {
          if (scheduledAt !== null && existing.status === 'DRAFT') {
            // Setting scheduledAt on a DRAFT campaign -> auto-transition to SCHEDULED
            updates.status = 'SCHEDULED';
          } else if (scheduledAt === null && existing.status === 'SCHEDULED') {
            // Removing scheduledAt from a SCHEDULED campaign -> revert to DRAFT
            updates.status = 'DRAFT';
          }
        }
      }

      // Store timezone in stats JSON alongside scheduledAt
      if (timezone !== undefined) {
        const existingStats = safeParseJson<Record<string, unknown>>(existing.stats, {}) ?? {};
        if (timezone === null || timezone === '') {
          delete existingStats.timezone;
        } else {
          existingStats.timezone = timezone;
        }
        updates.stats = JSON.stringify(existingStats);
      }

      const campaign = await prisma.emailCampaign.update({
        where: { id: params.id },
        data: updates,
      });

      logAdminAction({
        adminUserId: session.user.id,
        action: 'UPDATE_EMAIL_CAMPAIGN',
        targetType: 'EmailCampaign',
        targetId: params.id,
        previousValue: { name: existing.name, status: existing.status },
        newValue: updates,
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch(() => {});

      return NextResponse.json({ campaign });
    } catch (error) {
      logger.error('[Campaign Update] Error', { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);

export const DELETE = withAdminGuard(
  async (request: NextRequest, { session, params }: { session: { user: { id: string } }; params: { id: string } }) => {
    try {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip') || '127.0.0.1';
      const rl = await rateLimitMiddleware(ip, '/api/admin/emails/campaigns/[id]');
      if (!rl.success) {
        const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
        Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
        return res;
      }
      const csrfValid = await validateCsrf(request);
      if (!csrfValid) {
        return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
      }

      const existing = await prisma.emailCampaign.findUnique({ where: { id: params.id } });
      if (!existing) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }
      if (existing.status !== 'DRAFT') {
        return NextResponse.json({ error: 'Can only delete draft campaigns' }, { status: 400 });
      }
      await prisma.emailCampaign.delete({ where: { id: params.id } });

      logAdminAction({
        adminUserId: session.user.id,
        action: 'DELETE_EMAIL_CAMPAIGN',
        targetType: 'EmailCampaign',
        targetId: params.id,
        previousValue: { name: existing.name, status: existing.status },
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch(() => {});

      return NextResponse.json({ success: true });
    } catch (error) {
      logger.error('[Campaign Delete] Error', { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);
