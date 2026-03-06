export const dynamic = 'force-dynamic';

/**
 * Call Queue Management API
 * GET  — List queues
 * POST — Create queue with members
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { getQueueStats } from '@/lib/voip/queue-engine';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const companyId = searchParams.get('companyId');

    const queues = await prisma.callQueue.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        isActive: true,
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { priority: 'asc' },
        },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // Enrich queues with real-time stats from the queue engine
    const liveStats = getQueueStats();

    const enriched = queues.map(q => ({
      ...q,
      liveQueuedCalls: liveStats.byQueue[q.id] || 0,
    }));

    return NextResponse.json({ data: enriched, totalQueued: liveStats.totalQueued });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      companyId,
      name,
      strategy = 'RING_ALL',
      ringTimeout = 30,
      maxWaitTime = 300,
      wrapUpTime = 15,
      holdMusicUrl,
      announcePosition = true,
      announceInterval = 30,
      overflowAction = 'voicemail',
      overflowTarget,
      members = [],
    } = body;

    if (!companyId || !name) {
      return NextResponse.json(
        { error: 'companyId and name are required' },
        { status: 400 }
      );
    }

    const queue = await prisma.callQueue.create({
      data: {
        companyId,
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
        members: {
          create: members.map((m: { userId: string; priority?: number }) => ({
            userId: m.userId,
            priority: m.priority ?? 0,
          })),
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    return NextResponse.json({ data: queue }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
