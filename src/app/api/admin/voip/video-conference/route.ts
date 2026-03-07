export const dynamic = 'force-dynamic';

/**
 * Video Conference Rooms API (LiveKit)
 * GET  - List active video rooms
 * POST - Create a new video room
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { createRoom, listRooms } from '@/lib/voip/livekit-service';
import { logger } from '@/lib/logger';
import { z } from 'zod';

export const GET = withAdminGuard(async () => {
  try {
    const dbRooms = await prisma.videoRoom.findMany({
      where: { status: 'ACTIVE' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        recording: { select: { id: true, blobUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Try to get live participant counts from LiveKit
    let liveRooms: Array<{ name: string; numParticipants: number }> = [];
    try {
      liveRooms = await listRooms();
    } catch {
      // LiveKit may not be configured yet
    }

    const liveRoomMap = new Map(
      liveRooms.map((r) => [r.name, r.numParticipants])
    );

    const rooms = dbRooms.map((room) => ({
      ...room,
      participantCount: liveRoomMap.get(room.name) ?? 0,
    }));

    return NextResponse.json({ rooms });
  } catch (err) {
    logger.error('[video-conference] List rooms error', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

const createRoomSchema = z.object({
  displayName: z.string().min(1).max(100),
  maxParticipants: z.number().min(2).max(50).optional().default(10),
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();
    const parsed = createRoomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }

    const { displayName, maxParticipants } = parsed.data;
    const roomName = `conf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Create in LiveKit
    try {
      await createRoom(roomName, {
        maxParticipants,
        metadata: JSON.stringify({ displayName, createdBy: session.user!.id }),
      });
    } catch (err) {
      logger.error('[video-conference] LiveKit room creation failed', { error: err instanceof Error ? err.message : String(err) });
      return NextResponse.json({ error: 'Failed to create video room. Check LiveKit configuration.' }, { status: 503 });
    }

    // Save in DB
    const room = await prisma.videoRoom.create({
      data: {
        name: roomName,
        displayName,
        createdById: session.user!.id,
        maxParticipants,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ room }, { status: 201 });
  } catch (err) {
    logger.error('[video-conference] Create room error', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
