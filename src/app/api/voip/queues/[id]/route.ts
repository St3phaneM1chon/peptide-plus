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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const queue = await prisma.callQueue.findUnique({
    where: { id },
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

  return NextResponse.json({ data: queue });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
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
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  await prisma.callQueue.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ status: 'deactivated' });
}
