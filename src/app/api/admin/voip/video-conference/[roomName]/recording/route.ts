export const dynamic = 'force-dynamic';

/**
 * Conference Recording API
 * POST   - Start recording
 * DELETE - Stop recording
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import { startRoomRecording, stopRecording } from '@/lib/voip/livekit-recording';
import { logger } from '@/lib/logger';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return null;
  const role = session.user.role as string;
  if (role !== UserRole.EMPLOYEE && role !== UserRole.OWNER) return null;
  return session;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { roomName } = await params;

  try {
    const room = await prisma.videoRoom.findUnique({
      where: { name: roomName },
    });

    if (!room || room.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Room not found or not active' }, { status: 404 });
    }

    if (room.isRecording) {
      return NextResponse.json({ error: 'Already recording' }, { status: 409 });
    }

    const egressId = await startRoomRecording({ roomName });

    await prisma.videoRoom.update({
      where: { name: roomName },
      data: { isRecording: true, egressId },
    });

    return NextResponse.json({ success: true, egressId });
  } catch (err) {
    logger.error('[conference:recording] Start error', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Failed to start recording' }, { status: 500 });
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
    const room = await prisma.videoRoom.findUnique({
      where: { name: roomName },
    });

    if (!room || !room.isRecording || !room.egressId) {
      return NextResponse.json({ error: 'Not recording' }, { status: 400 });
    }

    await stopRecording(room.egressId);

    // Create a CallRecording entry for the conference recording (no callLogId for conference)
    const recording = await prisma.callRecording.create({
      data: {
        format: 'mp4',
        isUploaded: true,
        isVideo: true,
        consentObtained: true,
        consentMethod: 'conference_implicit',
      },
    });

    await prisma.videoRoom.update({
      where: { name: roomName },
      data: {
        isRecording: false,
        egressId: null,
        recordingId: recording.id,
      },
    });

    return NextResponse.json({ success: true, recordingId: recording.id });
  } catch (err) {
    logger.error('[conference:recording] Stop error', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Failed to stop recording' }, { status: 500 });
  }
}
