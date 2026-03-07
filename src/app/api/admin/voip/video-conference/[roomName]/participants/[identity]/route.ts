export const dynamic = 'force-dynamic';

/**
 * Conference Participant Management API
 * DELETE - Kick participant from room
 * PUT    - Mute/unmute participant
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { removeParticipant, muteParticipantTrack, getParticipant } from '@/lib/voip/livekit-service';
import { logger } from '@/lib/logger';

export const DELETE = withAdminGuard(async (
  _request: NextRequest,
  { params }
) => {
  const roomName = params!.roomName;
  const identity = params!.identity;

  try {
    await removeParticipant(roomName, identity);
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[conference:participant] Kick error', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Failed to remove participant' }, { status: 500 });
  }
});

export const PUT = withAdminGuard(async (
  request: NextRequest,
  { params }
) => {
  const roomName = params!.roomName;
  const identity = params!.identity;

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
});
