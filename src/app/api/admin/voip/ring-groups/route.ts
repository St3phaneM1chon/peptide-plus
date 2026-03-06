export const dynamic = 'force-dynamic';

/**
 * VoIP Ring Groups API
 *
 * GET    /api/admin/voip/ring-groups — List ring groups for company
 * POST   /api/admin/voip/ring-groups — Create a new ring group
 * PUT    /api/admin/voip/ring-groups — Update an existing ring group
 * DELETE /api/admin/voip/ring-groups — Delete (remove) a ring group
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import {
  getRingGroupsForCompany,
  getRingGroup,
  upsertRingGroup,
  deleteRingGroup,
  type RingGroup,
  type RingStrategy,
} from '@/lib/voip/ring-groups';

/**
 * GET - List ring groups for the user's company.
 * Also fetches CallQueue entries with RING_ALL strategy from DB.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'Missing companyId query parameter' },
        { status: 400 }
      );
    }

    // Get ring groups from in-memory state
    const memoryGroups = getRingGroupsForCompany(companyId);

    // Also fetch queue-backed ring groups from DB (RING_ALL strategy queues)
    const dbQueues = await prisma.callQueue.findMany({
      where: {
        companyId,
        strategy: 'RING_ALL',
        isActive: true,
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
      take: 200,
    });

    return NextResponse.json({
      data: {
        ringGroups: memoryGroups,
        queueBacked: dbQueues,
      },
    });
  } catch (error) {
    logger.error('[VoIP RingGroups] Failed to list ring groups', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to list ring groups' }, { status: 500 });
  }
}

/**
 * POST - Create a new ring group.
 * Body: { name, companyId, strategy?, members[], ringTimeout?, totalTimeout?, overflowAction?, overflowTarget?, skipBusy? }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      companyId,
      strategy = 'simultaneous',
      members = [],
      ringTimeout = 20,
      totalTimeout = 60,
      overflowAction = 'voicemail',
      overflowTarget = '',
      skipBusy = true,
      useDatabase = false,
    } = body as {
      name: string;
      companyId: string;
      strategy?: RingStrategy;
      members: string[];
      ringTimeout?: number;
      totalTimeout?: number;
      overflowAction?: 'voicemail' | 'extension' | 'external' | 'ivr';
      overflowTarget?: string;
      skipBusy?: boolean;
      useDatabase?: boolean;
    };

    if (!name || !companyId) {
      return NextResponse.json(
        { error: 'Missing required fields: name, companyId' },
        { status: 400 }
      );
    }

    if (!members.length) {
      return NextResponse.json(
        { error: 'Ring group must have at least one member' },
        { status: 400 }
      );
    }

    // If useDatabase, create a CallQueue with RING_ALL strategy + members
    if (useDatabase) {
      const queue = await prisma.callQueue.create({
        data: {
          name,
          companyId,
          strategy: 'RING_ALL',
          maxWaitTime: totalTimeout,
          wrapUpTime: 0,
          isActive: true,
          members: {
            create: members.map((userId: string, index: number) => ({
              userId,
              priority: index + 1,
              isActive: true,
            })),
          },
        },
        include: {
          members: true,
        },
      });

      return NextResponse.json({ data: queue }, { status: 201 });
    }

    // Otherwise use in-memory ring group engine
    const id = `rg-${companyId}-${Date.now()}`;
    const group: RingGroup = {
      id,
      name,
      companyId,
      strategy,
      members,
      ringTimeout,
      totalTimeout,
      overflowAction,
      overflowTarget,
      skipBusy,
    };

    upsertRingGroup(group);

    return NextResponse.json({ data: group }, { status: 201 });
  } catch (error) {
    logger.error('[VoIP RingGroups] Failed to create ring group', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create ring group' }, { status: 500 });
  }
}

/**
 * PUT - Update an existing ring group.
 * Body: { id, ...fields to update }
 */
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, queueId, ...updates } = body as {
      id?: string;
      queueId?: string;
      name?: string;
      strategy?: RingStrategy;
      members?: string[];
      ringTimeout?: number;
      totalTimeout?: number;
      overflowAction?: 'voicemail' | 'extension' | 'external' | 'ivr';
      overflowTarget?: string;
      skipBusy?: boolean;
    };

    // Update a DB-backed queue
    if (queueId) {
      const queue = await prisma.callQueue.update({
        where: { id: queueId },
        data: {
          ...(updates.name ? { name: updates.name } : {}),
          ...(updates.totalTimeout ? { maxWaitTime: updates.totalTimeout } : {}),
        },
        include: { members: true },
      });

      return NextResponse.json({ data: queue });
    }

    // Update in-memory ring group
    if (!id) {
      return NextResponse.json(
        { error: 'Missing id or queueId' },
        { status: 400 }
      );
    }

    const existing = getRingGroup(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Ring group not found' },
        { status: 404 }
      );
    }

    const updated: RingGroup = { ...existing, ...updates, id };
    upsertRingGroup(updated);

    return NextResponse.json({ data: updated });
  } catch (error) {
    logger.error('[VoIP RingGroups] Failed to update ring group', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to update ring group' }, { status: 500 });
  }
}

/**
 * DELETE - Delete a ring group (or soft-delete a DB queue).
 * Query: ?id=xxx or ?queueId=xxx
 */
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const queueId = searchParams.get('queueId');

    if (queueId) {
      // Soft-delete the DB queue
      await prisma.callQueue.update({
        where: { id: queueId },
        data: { isActive: false },
      });

      return NextResponse.json({ data: { deleted: true, queueId } });
    }

    if (!id) {
      return NextResponse.json(
        { error: 'Missing id or queueId query parameter' },
        { status: 400 }
      );
    }

    deleteRingGroup(id);

    return NextResponse.json({ data: { deleted: true, id } });
  } catch (error) {
    logger.error('[VoIP RingGroups] Failed to delete ring group', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to delete ring group' }, { status: 500 });
  }
}
