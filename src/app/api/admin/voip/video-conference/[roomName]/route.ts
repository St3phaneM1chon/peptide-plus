export const dynamic = 'force-dynamic';

/**
 * Conference Room Detail API
 * GET    - Get room details with participants
 * DELETE - End/close a room
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import { deleteRoom, listParticipants, getRoom } from '@/lib/voip/livekit-service';
import { logger } from '@/lib/logger';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return null;
  const role = session.user.role as string;
  if (role !== UserRole.EMPLOYEE && role !== UserRole.OWNER) return null;
  return session;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { roomName } = await params;

  try {
    const dbRoom = await prisma.videoRoom.findUnique({
      where: { name: roomName },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        recording: { select: { id: true, blobUrl: true, durationSec: true } },
      },
    });

    if (!dbRoom) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Get live info from LiveKit
    let participants: Array<{ identity: string; name: string; state: number }> = [];
    let liveRoom = null;
    try {
      liveRoom = await getRoom(roomName);
      if (liveRoom) {
        participants = await listParticipants(roomName);
      }
    } catch {
      // LiveKit unavailable
    }

    return NextResponse.json({
      room: {
        ...dbRoom,
        participants: participants.map((p) => ({
          identity: p.identity,
          name: p.name,
          state: p.state,
        })),
        participantCount: participants.length,
        isLive: !!liveRoom,
      },
    });
  } catch (err) {
    logger.error('[conference] Get room error', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { roomName } = await params;

  try {
    const dbRoom = await prisma.videoRoom.findUnique({
      where: { name: roomName },
    });

    if (!dbRoom) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Delete from LiveKit
    try {
      await deleteRoom(roomName);
    } catch {
      // May already be gone
    }

    // Update DB status
    await prisma.videoRoom.update({
      where: { name: roomName },
      data: {
        status: 'ENDED',
        endedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[conference] Delete room error', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
