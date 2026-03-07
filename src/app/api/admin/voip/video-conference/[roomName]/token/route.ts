export const dynamic = 'force-dynamic';

/**
 * Conference Room Token API
 * POST - Generate a join token for a participant
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import { generateToken, getPublicLiveKitUrl } from '@/lib/voip/livekit-service';
import { logger } from '@/lib/logger';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role as string;
  if (role !== UserRole.EMPLOYEE && role !== UserRole.OWNER) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { roomName } = await params;

  try {
    // Verify room exists and is active
    const room = await prisma.videoRoom.findUnique({
      where: { name: roomName },
    });

    if (!room || room.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Room not found or not active' }, { status: 404 });
    }

    const identity = session.user.id;
    const name = session.user.name || session.user.email || 'User';
    const isCreator = room.createdById === identity;

    const token = await generateToken(roomName, identity, {
      name,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      isAdmin: isCreator || role === UserRole.OWNER,
    });

    return NextResponse.json({
      token,
      url: getPublicLiveKitUrl(),
      identity,
      name,
    });
  } catch (err) {
    logger.error('[conference] Token generation error', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
  }
}
