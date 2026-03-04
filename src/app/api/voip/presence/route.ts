export const dynamic = 'force-dynamic';

/**
 * VoIP Presence Status API
 *
 * GET    /api/voip/presence — List all online agents
 * PUT    /api/voip/presence — Update current user's presence status
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';

/**
 * GET - List agents with their current presence status.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (status) where.status = status.toUpperCase();

    const presences = await prisma.presenceStatus.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ data: presences });
  } catch (error) {
    logger.error('[VoIP Presence] Failed to list presence', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to list presence' }, { status: 500 });
  }
}

/**
 * PUT - Update a user's presence status.
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, status, statusText, deviceType } = body;

    if (!userId || !status) {
      return NextResponse.json(
        { error: 'Missing userId or status' },
        { status: 400 }
      );
    }

    const validStatuses = ['ONLINE', 'BUSY', 'DND', 'AWAY', 'OFFLINE'];
    if (!validStatuses.includes(status.toUpperCase())) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const presence = await prisma.presenceStatus.upsert({
      where: {
        userId_deviceType: {
          userId,
          deviceType: deviceType || 'unknown',
        },
      },
      create: {
        userId,
        status: status.toUpperCase(),
        statusText,
        deviceType: deviceType || 'unknown',
        onlineSince: status.toUpperCase() === 'ONLINE' ? new Date() : null,
        lastActivity: new Date(),
      },
      update: {
        status: status.toUpperCase(),
        statusText,
        lastActivity: new Date(),
        ...(status.toUpperCase() === 'ONLINE' ? { onlineSince: new Date() } : {}),
        ...(status.toUpperCase() === 'OFFLINE' ? { onlineSince: null } : {}),
      },
    });

    return NextResponse.json({ data: presence });
  } catch (error) {
    logger.error('[VoIP Presence] Failed to update presence', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to update presence' }, { status: 500 });
  }
}
