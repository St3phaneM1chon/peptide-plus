export const dynamic = 'force-dynamic';

/**
 * Call Queue Detail API
 * GET    — Get queue with members
 * PUT    — Update queue settings and members
 * DELETE — Deactivate queue
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { resolveTenant } from '@/lib/voip/tenant-context';
import { getQueueStats } from '@/lib/voip/queue-engine';

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

    const queue = await prisma.callQueue.findFirst({
      where: { id, companyId: tenant.companyId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                presenceStatuses: { select: { status: true, deviceType: true } },
              },
            },
          },
          orderBy: { priority: 'asc' },
        },
      },
    });

    if (!queue) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Enrich with live queued call count from the queue engine
    const liveStats = getQueueStats();
    const enriched = {
      ...queue,
      liveQueuedCalls: liveStats.byQueue[queue.id] || 0,
    };

    return NextResponse.json({ data: enriched });
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

    // Verify queue belongs to tenant
    const existing = await prisma.callQueue.findFirst({
      where: { id, companyId: tenant.companyId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();

    const {
      name,
      strategy,
      ringTimeout,
      maxWaitTime,
      wrapUpTime,
      holdMusicUrl,
      announcePosition,
      announceInterval,
      overflowAction,
      overflowTarget,
      isActive,
      members,
    } = body;

    await prisma.callQueue.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(strategy !== undefined ? { strategy } : {}),
        ...(ringTimeout !== undefined ? { ringTimeout } : {}),
        ...(maxWaitTime !== undefined ? { maxWaitTime } : {}),
        ...(wrapUpTime !== undefined ? { wrapUpTime } : {}),
        ...(holdMusicUrl !== undefined ? { holdMusicUrl } : {}),
        ...(announcePosition !== undefined ? { announcePosition } : {}),
        ...(announceInterval !== undefined ? { announceInterval } : {}),
        ...(overflowAction !== undefined ? { overflowAction } : {}),
        ...(overflowTarget !== undefined ? { overflowTarget } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    // Replace members if provided
    if (members) {
      await prisma.callQueueMember.deleteMany({ where: { queueId: id } });
      await prisma.callQueueMember.createMany({
        data: members.map((m: { userId: string; priority?: number }) => ({
          queueId: id,
          userId: m.userId,
          priority: m.priority ?? 0,
        })),
      });
    }

    const updated = await prisma.callQueue.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { priority: 'asc' },
        },
      },
    });

    return NextResponse.json({ data: updated });
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

    // Verify queue belongs to tenant
    const existing = await prisma.callQueue.findFirst({
      where: { id, companyId: tenant.companyId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.callQueue.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ status: 'deactivated' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
