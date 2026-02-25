export const dynamic = 'force-dynamic';

/**
 * Admin Email Campaigns API
 * GET  - List campaigns
 * POST - Create campaign
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { safeParseJson } from '@/lib/email/utils';
import { logger } from '@/lib/logger';

const createCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  subject: z.string().min(1).max(500).optional(),
  htmlContent: z.string().min(1).optional(),
  textContent: z.string().nullable().optional(),
  segmentQuery: z.unknown().optional(),
  scheduledAt: z.string().nullable().optional(),
  abTestConfig: z.unknown().optional(),
  sourceId: z.string().optional(),
});

export const GET = withAdminGuard(async (request, { session: _session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')));

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [campaigns, total] = await Promise.all([
      prisma.emailCampaign.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.emailCampaign.count({ where }),
    ]);

    const STATUS_COLORS: Record<string, string> = {
      DRAFT: 'gray',
      SCHEDULED: 'blue',
      SENDING: 'yellow',
      SENT: 'green',
      FAILED: 'red',
      PAUSED: 'orange',
    };

    const campaignsWithStats = campaigns.map(c => ({
      ...c,
      stats: safeParseJson(c.stats, { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, revenue: 0 }),
      segmentQuery: safeParseJson(c.segmentQuery, null),
      abTestConfig: safeParseJson(c.abTestConfig, null),
      statusColor: STATUS_COLORS[c.status] || 'gray',
    }));

    return NextResponse.json({
      campaigns: campaignsWithStats,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('[Campaigns] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/admin/emails/campaigns');
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
    const parsed = createCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { name, subject, htmlContent, textContent, segmentQuery, scheduledAt, abTestConfig, sourceId } = parsed.data;

    // Clone mode: duplicate an existing campaign
    if (sourceId) {
      const source = await prisma.emailCampaign.findUnique({ where: { id: sourceId } });
      if (!source) {
        return NextResponse.json({ error: 'Source campaign not found' }, { status: 404 });
      }

      const cloned = await prisma.emailCampaign.create({
        data: {
          name: name || `${source.name} (Copy)`,
          subject: source.subject,
          htmlContent: source.htmlContent,
          textContent: source.textContent,
          segmentQuery: source.segmentQuery,
          status: 'DRAFT',
          scheduledAt: null,
          sentAt: null,
          stats: null,
          abTestConfig: source.abTestConfig,
          createdBy: session.user.id,
        },
      });

      logAdminAction({
        adminUserId: session.user.id,
        action: 'CLONE_EMAIL_CAMPAIGN',
        targetType: 'EmailCampaign',
        targetId: cloned.id,
        newValue: { name: cloned.name, sourceId, status: 'DRAFT' },
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch((err: unknown) => { logger.error('[Campaigns] Non-blocking audit log for clone failed', { error: err instanceof Error ? err.message : String(err) }); });

      return NextResponse.json({
        campaign: {
          ...cloned,
          stats: safeParseJson(cloned.stats, { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, revenue: 0 }),
          segmentQuery: safeParseJson(cloned.segmentQuery, null),
          abTestConfig: safeParseJson(cloned.abTestConfig, null),
        },
      });
    }

    // Normal creation mode
    if (!name || !subject || !htmlContent) {
      return NextResponse.json({ error: 'Name, subject, and htmlContent are required' }, { status: 400 });
    }

    const campaign = await prisma.emailCampaign.create({
      data: {
        name,
        subject,
        htmlContent,
        textContent: textContent || null,
        segmentQuery: segmentQuery ? JSON.stringify(segmentQuery) : null,
        status: 'DRAFT',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        abTestConfig: abTestConfig ? JSON.stringify(abTestConfig) : null,
        createdBy: session.user.id,
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'CREATE_EMAIL_CAMPAIGN',
      targetType: 'EmailCampaign',
      targetId: campaign.id,
      newValue: { name, subject, status: 'DRAFT' },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch((err: unknown) => { logger.error('[Campaigns] Non-blocking audit log for create failed', { error: err instanceof Error ? err.message : String(err) }); });

    return NextResponse.json({ campaign });
  } catch (error) {
    logger.error('[Campaigns] Create error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
