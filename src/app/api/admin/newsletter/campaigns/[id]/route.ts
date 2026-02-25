export const dynamic = 'force-dynamic';

/**
 * Admin Newsletter Campaign [id] API
 * GET - Get single campaign details
 * PATCH - Update campaign (status, content)
 * DELETE - Delete a campaign
 *
 * FIX: FLAW-002 - Route was missing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }>; session: unknown }
  ) => {
    try {
      const { id } = await params;

      const campaign = await prisma.emailCampaign.findUnique({
        where: { id },
      });

      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }

      return NextResponse.json({ campaign });
    } catch (error) {
      logger.error('Admin newsletter campaign GET error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 });
    }
  }
);

export const PATCH = withAdminGuard(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }>; session: unknown }
  ) => {
    try {
      const { id } = await params;
      const body = await request.json();

      const data: Record<string, unknown> = {};
      if (body.subject !== undefined) {
        data.subject = body.subject;
        data.name = body.subject;
      }
      if (body.content !== undefined) data.htmlContent = body.content;
      if (body.status !== undefined) {
        if (body.status === 'SENT') {
          data.status = 'SCHEDULED';
          data.scheduledAt = new Date();
        } else {
          data.status = body.status;
        }
      }
      if (body.scheduledFor !== undefined) data.scheduledAt = new Date(body.scheduledFor);

      const updated = await prisma.emailCampaign.update({
        where: { id },
        data,
      });

      return NextResponse.json({ campaign: updated });
    } catch (error) {
      logger.error('Admin newsletter campaign PATCH error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
    }
  }
);

export const DELETE = withAdminGuard(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }>; session: unknown }
  ) => {
    try {
      const { id } = await params;

      const campaign = await prisma.emailCampaign.findUnique({
        where: { id },
        select: { status: true },
      });

      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }

      if (campaign.status === 'SENT') {
        return NextResponse.json(
          { error: 'Cannot delete a sent campaign' },
          { status: 400 }
        );
      }

      await prisma.emailCampaign.delete({ where: { id } });

      return NextResponse.json({ success: true });
    } catch (error) {
      logger.error('Admin newsletter campaign DELETE error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
    }
  }
);
