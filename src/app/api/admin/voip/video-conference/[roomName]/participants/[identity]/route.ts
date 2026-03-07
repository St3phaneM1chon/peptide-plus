export const dynamic = 'force-dynamic';

/**
 * Conference Participant Management API
 * DELETE - Kick participant from room
 * PUT    - Mute/unmute participant
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import { removeParticipant, muteParticipantTrack, getParticipant } from '@/lib/voip/livekit-service';
import { logger } from '@/lib/logger';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return null;
  const role = session.user.role as string;
  if (role !== UserRole.EMPLOYEE && role !== UserRole.OWNER) return null;
  return session;
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ roomName: string; identity: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { roomName, identity } = await params;

  try {
    await removeParticipant(roomName, identity);
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[conference:participant] Kick error', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Failed to remove participant' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roomName: string; identity: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { roomName, identity } = await params;

  try {
    const body = await request.json();
    const { trackSid, muted } = body;

    if (!trackSid) {
      // If no specific track, mute all audio tracks
      const participant = await getParticipant(roomName, identity);
      if (participant?.tracks) {
        for (const track of participant.tracks) {
          if (track.type === 1) { // AUDIO
            await muteParticipantTrack(roomName, identity, track.sid, muted ?? true);
          }
        }
      }
    } else {
      await muteParticipantTrack(roomName, identity, trackSid, muted ?? true);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[conference:participant] Mute error', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Failed to mute participant' }, { status: 500 });
  }
}
