export const dynamic = 'force-dynamic';

/**
 * Single Campaign API
 * GET    — Campaign detail with contact list + stats
 * PUT    — Update campaign settings
 * DELETE — Delete campaign (only if DRAFT)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { resolveTenant } from '@/lib/voip/tenant-context';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Resolve tenant to scope by companyId
    const tenant = await resolveTenant(session.user.id);
    if (!tenant) {
      return NextResponse.json({ error: 'No tenant access' }, { status: 403 });
    }

    const campaign = await prisma.dialerCampaign.findFirst({
      where: { id, companyId: tenant.companyId },
      include: {
        dialerList: {
          orderBy: { createdAt: 'asc' },
          take: 200,
        },
        dispositions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        _count: {
          select: {
            dialerList: true,
            dispositions: true,
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Compute stats
    const stats = await prisma.dialerListEntry.groupBy({
      by: ['isDncl', 'isCalled'],
      where: { campaignId: id },
      _count: true,
    });

    return NextResponse.json({ data: campaign, stats });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Resolve tenant to scope by companyId
    const tenant = await resolveTenant(session.user.id);
    if (!tenant) {
      return NextResponse.json({ error: 'No tenant access' }, { status: 403 });
    }

    // Verify campaign belongs to tenant
    const existing = await prisma.dialerCampaign.findFirst({
      where: { id, companyId: tenant.companyId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const raw = await request.json();
    const parsed = z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']).optional(),
      callerIdNumber: z.string().optional(),
      maxConcurrent: z.number().int().positive().optional(),
      useAmd: z.boolean().optional(),
      scriptTitle: z.string().optional(),
      scriptBody: z.string().optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      timezone: z.string().optional(),
      activeDays: z.array(z.string()).optional(),
    }).safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      name,
      description,
      status,
      callerIdNumber,
      maxConcurrent,
      useAmd,
      scriptTitle,
      scriptBody,
      startTime,
      endTime,
      timezone,
      activeDays,
    } = parsed.data;

    const campaign = await prisma.dialerCampaign.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(status !== undefined ? { status: status as 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED' } : {}),
        ...(callerIdNumber !== undefined ? { callerIdNumber } : {}),
        ...(maxConcurrent !== undefined ? { maxConcurrent } : {}),
        ...(useAmd !== undefined ? { useAmd } : {}),
        ...(scriptTitle !== undefined ? { scriptTitle } : {}),
        ...(scriptBody !== undefined ? { scriptBody } : {}),
        ...(startTime !== undefined ? { startTime } : {}),
        ...(endTime !== undefined ? { endTime } : {}),
        ...(timezone !== undefined ? { timezone } : {}),
        ...(activeDays !== undefined ? { activeDays } : {}),
      },
      include: {
        _count: { select: { dialerList: true } },
      },
    });

    return NextResponse.json({ data: campaign });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Resolve tenant to scope by companyId
    const tenant = await resolveTenant(session.user.id);
    if (!tenant) {
      return NextResponse.json({ error: 'No tenant access' }, { status: 403 });
    }

    const campaign = await prisma.dialerCampaign.findFirst({
      where: { id, companyId: tenant.companyId },
      select: { status: true },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (campaign.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Can only delete DRAFT campaigns' },
        { status: 400 }
      );
    }

    // Delete associated entries first, then campaign
    await prisma.dialerDisposition.deleteMany({ where: { campaignId: id } });
    await prisma.dialerListEntry.deleteMany({ where: { campaignId: id } });
    await prisma.dialerCampaign.delete({ where: { id } });

    return NextResponse.json({ status: 'deleted' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
