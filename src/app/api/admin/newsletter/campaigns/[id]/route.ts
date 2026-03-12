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
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const updateCampaignSchema = z.object({
  subject: z.string().min(1).max(500).optional(),
  content: z.string().max(500000).optional(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'SENT', 'PAUSED', 'CANCELLED']).optional(),
  scheduledFor: z.string().datetime().optional(),
});

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

      const parsed = updateCampaignSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid data', details: parsed.error.errors },
          { status: 400 }
        );
      }

      const data: Record<string, unknown> = {};
      if (parsed.data.subject !== undefined) {
        data.subject = parsed.data.subject;
        data.name = parsed.data.subject;
      }
      if (parsed.data.content !== undefined) data.htmlContent = parsed.data.content;
      if (parsed.data.status !== undefined) {
        if (parsed.data.status === 'SENT') {
          data.status = 'SCHEDULED';
          data.scheduledAt = new Date();
        } else {
          data.status = parsed.data.status;
        }
      }
      if (parsed.data.scheduledFor !== undefined) data.scheduledAt = new Date(parsed.data.scheduledFor);

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
