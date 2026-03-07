export const dynamic = 'force-dynamic';

/**
 * VoIP DND (Do Not Disturb) Configuration API
 *
 * GET /api/admin/voip/dnd-config — Get DND config for current user
 * PUT /api/admin/voip/dnd-config — Update DND config (mode, schedule, exceptions)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import {
  getDndState,
  setDndConfig,
  toggleDnd,
  addException,
  removeException,
  type DndConfig,
} from '@/lib/voip/dnd-manager';

const dndPutSchema = z.object({
  toggle: z.boolean().optional(),
  addException: z.string().optional(),
  removeException: z.string().optional(),
  config: z.object({
    mode: z.string().optional(),
    exceptions: z.array(z.string()).optional(),
    schedules: z.array(z.unknown()).optional(),
    autoCalendarDnd: z.boolean().optional(),
    goToVoicemail: z.boolean().optional(),
    message: z.string().optional(),
  }).optional(),
});

/**
 * GET - Get DND configuration and current state for the current user.
 * Also reads PresenceStatus from DB for consistency.
 */
export const GET = withAdminGuard(async (_request: NextRequest, { session }) => {
  try {
    // Get in-memory DND state
    const dndState = getDndState(session.user.id);

    // Get PresenceStatus from DB
    const presenceStatuses = await prisma.presenceStatus.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    const isDndInPresence = presenceStatuses.some(p => p.status === 'DND');

    return NextResponse.json({
      data: {
        dndState: dndState ?? {
          userId: session.user.id,
          extensionId: null,
          config: {
            mode: 'off',
            exceptions: [],
            schedules: [],
            autoCalendarDnd: false,
            goToVoicemail: true,
          },
          isActive: isDndInPresence,
        },
        presenceStatuses,
      },
    });
  } catch (error) {
    logger.error('[VoIP DND] Failed to get DND config', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to get DND config' }, { status: 500 });
  }
});

/**
 * PUT - Update DND configuration.
 * Body: { toggle?: boolean } — quick toggle on/off
 *    or { config: Partial<DndConfig> } — full config update
 *    or { addException: string } — add a number to whitelist
 *    or { removeException: string } — remove a number from whitelist
 */
export const PUT = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const raw = await request.json();
    const parsed = dndPutSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const body = parsed.data;

    // Quick toggle
    if (body.toggle === true) {
      const state = await toggleDnd(session.user.id);

      // Also update PresenceStatus in DB
      await prisma.presenceStatus.updateMany({
        where: { userId: session.user.id },
        data: {
          status: state.isActive ? 'DND' : 'ONLINE',
          lastActivity: new Date(),
        },
      });

      return NextResponse.json({ data: state });
    }

    // Add exception
    if (body.addException) {
      await addException(session.user.id, body.addException);
      const state = getDndState(session.user.id);
      return NextResponse.json({ data: state });
    }

    // Remove exception
    if (body.removeException) {
      await removeException(session.user.id, body.removeException);
      const state = getDndState(session.user.id);
      return NextResponse.json({ data: state });
    }

    // Full config update
    if (body.config) {
      const config = body.config as unknown as Partial<DndConfig>;
      const state = await setDndConfig(session.user.id, config);

      // Sync with PresenceStatus in DB
      await prisma.presenceStatus.updateMany({
        where: { userId: session.user.id },
        data: {
          status: state.isActive ? 'DND' : 'ONLINE',
          statusText: state.isActive ? (state.config.message ?? 'Do Not Disturb') : null,
          lastActivity: new Date(),
        },
      });

      return NextResponse.json({ data: state });
    }

    return NextResponse.json(
      { error: 'Provide { toggle }, { config }, { addException }, or { removeException }' },
      { status: 400 }
    );
  } catch (error) {
    logger.error('[VoIP DND] Failed to update DND config', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to update DND config' }, { status: 500 });
  }
});
