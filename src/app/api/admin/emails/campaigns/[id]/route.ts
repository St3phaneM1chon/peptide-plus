export const dynamic = 'force-dynamic';

/**
 * Admin Email Campaign Detail API
 * GET    - Get campaign detail
 * PUT    - Update campaign
 * DELETE - Delete campaign (only DRAFT)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';

export const GET = withAdminGuard(
  async (_request: NextRequest, { session: _session, params }: { session: unknown; params: { id: string } }) => {
    try {
      const campaign = await prisma.emailCampaign.findUnique({ where: { id: params.id } });
      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }
      return NextResponse.json({
        campaign: {
          ...campaign,
          stats: campaign.stats ? JSON.parse(campaign.stats) : null,
          segmentQuery: campaign.segmentQuery ? JSON.parse(campaign.segmentQuery) : null,
          abTestConfig: campaign.abTestConfig ? JSON.parse(campaign.abTestConfig) : null,
        },
      });
    } catch (error) {
      console.error('[Campaign Detail] Error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);

export const PUT = withAdminGuard(
  async (request: NextRequest, { session, params }: { session: { user: { id: string } }; params: { id: string } }) => {
    try {
      const body = await request.json();
      const { name, subject, htmlContent, textContent, segmentQuery, scheduledAt, status, abTestConfig } = body;

      const existing = await prisma.emailCampaign.findUnique({ where: { id: params.id } });
      if (!existing) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }

      // Don't allow editing sent campaigns
      if (existing.status === 'SENT' || existing.status === 'SENDING') {
        return NextResponse.json({ error: 'Cannot edit a sent or sending campaign' }, { status: 400 });
      }

      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (subject !== undefined) updates.subject = subject;
      if (htmlContent !== undefined) updates.htmlContent = htmlContent;
      if (textContent !== undefined) updates.textContent = textContent;
      if (segmentQuery !== undefined) updates.segmentQuery = segmentQuery ? JSON.stringify(segmentQuery) : null;
      if (scheduledAt !== undefined) updates.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
      if (status !== undefined) updates.status = status;
      if (abTestConfig !== undefined) updates.abTestConfig = abTestConfig ? JSON.stringify(abTestConfig) : null;

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
      console.error('[Campaign Update] Error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);

export const DELETE = withAdminGuard(
  async (_request: NextRequest, { session, params }: { session: { user: { id: string } }; params: { id: string } }) => {
    try {
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
        ipAddress: getClientIpFromRequest(_request),
        userAgent: _request.headers.get('user-agent') || undefined,
      }).catch(() => {});

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('[Campaign Delete] Error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);
