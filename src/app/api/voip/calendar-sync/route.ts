export const dynamic = 'force-dynamic';

/**
 * Calendar Sync API — Integrate calendar presence with VoIP status
 *
 * GET  /api/voip/calendar-sync — Get calendar events and presence recommendation
 * POST /api/voip/calendar-sync — Sync calendar and optionally update presence
 *
 * Wires into: src/lib/voip/calendar-sync.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth-config';
import {
  CalendarSync,
  type CalendarSyncConfig,
  type CalendarEvent,
} from '@/lib/voip/calendar-sync';

/**
 * Per-user CalendarSync instances (in-memory, scoped to server lifetime).
 * In production this would use a session store or Redis.
 */
const syncInstances = new Map<string, CalendarSync>();

function getOrCreateSync(
  userId: string,
  config: CalendarSyncConfig,
): CalendarSync {
  const existing = syncInstances.get(userId);
  if (existing) return existing;

  const instance = new CalendarSync(config);
  syncInstances.set(userId, instance);
  return instance;
}

/**
 * GET - Get calendar events and current presence recommendation.
 *
 * Query params:
 * - upcomingHours: number (default 4) - how many hours ahead to look
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const upcomingHours = parseInt(searchParams.get('upcomingHours') || '4', 10);

    const sync = syncInstances.get(session.user.id);

    if (!sync) {
      return NextResponse.json({
        data: {
          synced: false,
          presence: 'available',
          currentMeeting: null,
          upcoming: [],
          message: 'Calendar not synced. POST to /api/voip/calendar-sync to configure.',
        },
      });
    }

    const currentMeeting: CalendarEvent | null = sync.isInMeeting();
    const upcoming: CalendarEvent[] = sync.getUpcoming(upcomingHours);
    const presence: string = sync.getCalendarPresence();

    return NextResponse.json({
      data: {
        synced: true,
        presence,
        currentMeeting,
        upcoming,
      },
    });
  } catch (error) {
    logger.error('[CalendarSync API] Failed to get calendar state', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to get calendar state' }, { status: 500 });
  }
}

/**
 * POST - Configure and sync calendar.
 *
 * Body:
 * - provider: 'google' | 'outlook'
 * - accessToken: string
 * - refreshToken?: string
 * - syncInterval?: number (minutes)
 * - autoPresence?: boolean
 * - action?: 'sync' | 'configure' | 'stop' (default: 'configure')
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const raw = await request.json();
    const parsed = z.object({
      provider: z.enum(['google', 'outlook']).optional(),
      accessToken: z.string().optional(),
      refreshToken: z.string().optional(),
      syncInterval: z.number().int().positive().optional().default(5),
      autoPresence: z.boolean().optional().default(true),
      action: z.enum(['sync', 'configure', 'stop']).optional().default('configure'),
    }).safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const {
      provider,
      accessToken,
      refreshToken,
      syncInterval,
      autoPresence,
      action,
    } = parsed.data;

    // Stop auto-sync
    if (action === 'stop') {
      const existing = syncInstances.get(session.user.id);
      if (existing) {
        existing.stopAutoSync();
        syncInstances.delete(session.user.id);
      }
      return NextResponse.json({ data: { status: 'stopped' } });
    }

    // Sync existing instance
    if (action === 'sync') {
      const existing = syncInstances.get(session.user.id);
      if (!existing) {
        return NextResponse.json(
          { error: 'Calendar not configured. Use action=configure first.' },
          { status: 400 },
        );
      }
      const events = await existing.sync();
      return NextResponse.json({
        data: {
          eventCount: events.length,
          presence: existing.getCalendarPresence(),
          currentMeeting: existing.isInMeeting(),
        },
      });
    }

    // Configure new sync
    if (!provider || !accessToken) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, accessToken' },
        { status: 400 },
      );
    }

    const config: CalendarSyncConfig = {
      provider,
      accessToken,
      refreshToken,
      syncInterval,
      autoPresence,
    };

    const sync = getOrCreateSync(session.user.id, config);
    const events = await sync.sync();

    if (autoPresence) {
      sync.startAutoSync();
    }

    logger.info('[CalendarSync API] Calendar configured', {
      userId: session.user.id,
      provider,
      eventCount: events.length,
      autoPresence,
    });

    return NextResponse.json({
      data: {
        status: 'configured',
        provider,
        eventCount: events.length,
        presence: sync.getCalendarPresence(),
        currentMeeting: sync.isInMeeting(),
        upcoming: sync.getUpcoming(4),
      },
    }, { status: 201 });
  } catch (error) {
    logger.error('[CalendarSync API] Configuration failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Calendar sync configuration failed' }, { status: 500 });
  }
}
