export const dynamic = 'force-dynamic';

/**
 * Call Queue Management API
 * GET  — List queues
 * POST — Create queue with members
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { getQueueStats } from '@/lib/voip/queue-engine';

const queueCreateSchema = z.object({
  companyId: z.string().min(1, 'companyId is required'),
  name: z.string().min(1, 'name is required'),
  strategy: z.enum(['RING_ALL', 'ROUND_ROBIN', 'LEAST_RECENT', 'RANDOM', 'HUNT']).default('RING_ALL'),
  ringTimeout: z.number().int().positive().default(30),
  maxWaitTime: z.number().int().positive().default(300),
  wrapUpTime: z.number().int().nonnegative().default(15),
  holdMusicUrl: z.string().url().nullable().optional(),
  announcePosition: z.boolean().default(true),
  announceInterval: z.number().int().positive().default(30),
  overflowAction: z.string().default('voicemail'),
  overflowTarget: z.string().nullable().optional(),
  members: z.array(z.object({
    userId: z.string().min(1),
    priority: z.number().int().nonnegative().optional(),
  })).default([]),
});

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
    const raw = await request.json();
    const parsed = queueCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const {
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
      members,
    } = parsed.data;

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
