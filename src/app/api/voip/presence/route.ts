export const dynamic = 'force-dynamic';

/**
 * VoIP Presence Status API
 *
 * GET    /api/voip/presence — List all online agents
 * PUT    /api/voip/presence — Update current user's presence status
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import type { CalendarSyncConfig } from '@/lib/voip/calendar-sync';

const presenceUpdateSchema = z.object({
  status: z.string().min(1, 'Missing status'),
  statusText: z.string().optional(),
  deviceType: z.string().optional(),
});

/**
 * GET - List agents with their current presence status.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
      take: 200,
    });

    // Expose calendar-sync availability hint.
    // Clients can use /api/voip/calendar-sync to configure per-user calendar integration,
    // which feeds into the MEETING presence status via CalendarSync.getCalendarPresence().
    return NextResponse.json({
      data: presences,
      calendarSync: {
        available: true,
        configureUrl: '/api/voip/calendar-sync',
        supportedProviders: ['google', 'outlook'] satisfies CalendarSyncConfig['provider'][],
      },
    });
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
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const raw = await request.json();
    const parsed = presenceUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { status: rawStatus, statusText, deviceType } = parsed.data;
    // Force userId from session to prevent privilege escalation
    // (ignore any userId provided in the request body)
    const userId = session.user.id;

    const statusUpper = rawStatus.toUpperCase();

    // MEETING status is derived from calendar-sync integration (CalendarSync.getCalendarPresence())
    const validStatuses = ['ONLINE', 'BUSY', 'DND', 'AWAY', 'OFFLINE', 'MEETING'];
    if (!validStatuses.includes(statusUpper)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Cast validated status to Prisma enum type
    const status = statusUpper as import('@prisma/client').AgentStatus;

    const presence = await prisma.presenceStatus.upsert({
      where: {
        userId_deviceType: {
          userId,
          deviceType: deviceType || 'unknown',
        },
      },
      create: {
        userId,
        status,
        statusText,
        deviceType: deviceType || 'unknown',
        onlineSince: statusUpper === 'ONLINE' ? new Date() : null,
        lastActivity: new Date(),
      },
      update: {
        status,
        statusText,
        lastActivity: new Date(),
        ...(statusUpper === 'ONLINE' ? { onlineSince: new Date() } : {}),
        ...(statusUpper === 'OFFLINE' ? { onlineSince: null } : {}),
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
