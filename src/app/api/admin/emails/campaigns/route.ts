export const dynamic = 'force-dynamic';

/**
 * Admin Email Campaigns API
 * GET  - List campaigns
 * POST - Create campaign
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';

function safeParseJson<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

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

    const campaignsWithStats = campaigns.map(c => ({
      ...c,
      stats: safeParseJson(c.stats, { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, revenue: 0 }),
      segmentQuery: safeParseJson(c.segmentQuery, null),
      abTestConfig: safeParseJson(c.abTestConfig, null),
    }));

    return NextResponse.json({
      campaigns: campaignsWithStats,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[Campaigns] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const { name, subject, htmlContent, textContent, segmentQuery, scheduledAt, abTestConfig } = body;

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
    }).catch(() => {});

    return NextResponse.json({ campaign });
  } catch (error) {
    console.error('[Campaigns] Create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
