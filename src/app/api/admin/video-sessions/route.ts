export const dynamic = 'force-dynamic';

/**
 * Video Sessions API
 * POST - Create a video session with a client (creates platform meeting + saves session)
 * GET  - List video sessions with filters and pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { createPlatformMeeting } from '@/lib/platform/meeting-creation';
import { sendMeetingInvitationEmail } from '@/lib/email/meeting-invitation';
import { type Platform } from '@/lib/platform/oauth';
import { VideoSessionStatus } from '@prisma/client';
import { logger } from '@/lib/logger';

const VIDEO_PLATFORMS = ['zoom', 'teams', 'google-meet', 'webex'];

// ---------------------------------------------------------------------------
// POST - Create Video Session
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();
    const {
      platform,
      topic,
      contentType,
      clientId,
      scheduledAt,
      duration,
      notes,
      startNow,
    } = body as {
      platform?: string;
      topic?: string;
      contentType?: string;
      clientId?: string;
      scheduledAt?: string;
      duration?: number;
      notes?: string;
      startNow?: boolean;
    };

    if (!platform || !topic) {
      return NextResponse.json(
        { error: 'Missing required fields: platform, topic' },
        { status: 400 },
      );
    }

    if (!VIDEO_PLATFORMS.includes(platform)) {
      return NextResponse.json(
        { error: `Invalid platform. Supported: ${VIDEO_PLATFORMS.join(', ')}` },
        { status: 400 },
      );
    }

    const startTime = startNow
      ? new Date().toISOString()
      : scheduledAt || new Date().toISOString();
    const meetingDuration = duration || 30;

    // Load client info for invitation email
    let clientEmail: string | undefined;
    let clientName: string | undefined;
    if (clientId) {
      const client = await prisma.user.findUnique({
        where: { id: clientId },
        select: { email: true, name: true },
      });
      if (client) {
        clientEmail = client.email;
        clientName = client.name || client.email;
      }
    }

    // Create meeting on the platform
    const meeting = await createPlatformMeeting({
      platform: platform as Platform,
      topic,
      startTime,
      duration: meetingDuration,
      inviteeEmail: clientEmail,
      inviteeName: clientName,
    });

    // Save VideoSession in database
    const videoSession = await prisma.videoSession.create({
      data: {
        platform,
        topic,
        contentType: contentType as never || 'OTHER',
        status: startNow ? VideoSessionStatus.IN_PROGRESS : VideoSessionStatus.SCHEDULED,
        scheduledAt: new Date(startTime),
        duration: meetingDuration,
        startedAt: startNow ? new Date() : null,
        meetingId: meeting.meetingId,
        hostJoinUrl: meeting.hostJoinUrl,
        clientJoinUrl: meeting.clientJoinUrl,
        password: meeting.password,
        clientId: clientId || null,
        createdById: session.user.id,
        notes: notes || null,
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    // Send invitation email to client
    let emailResult = null;
    if (clientEmail) {
      try {
        emailResult = await sendMeetingInvitationEmail({
          recipientEmail: clientEmail,
          recipientName: clientName || clientEmail,
          topic: meeting.topic,
          startTime: meeting.startTime,
          duration: meeting.duration,
          joinUrl: meeting.clientJoinUrl,
          platform: meeting.platform,
          password: meeting.password,
        });
      } catch (emailError) {
        logger.warn('[VideoSessions] Failed to send invitation email', {
          error: emailError instanceof Error ? emailError.message : String(emailError),
        });
      }
    }

    return NextResponse.json({
      session: videoSession,
      meeting,
      email: emailResult
        ? { sent: emailResult.success, error: emailResult.error }
        : null,
    }, { status: 201 });
  } catch (error) {
    logger.error('[VideoSessions] Create error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create video session' },
      { status: 500 },
    );
  }
});

// ---------------------------------------------------------------------------
// GET - List Video Sessions
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const url = new URL(request.url);
    const platform = url.searchParams.get('platform');
    const status = url.searchParams.get('status');
    const clientId = url.searchParams.get('clientId');
    const search = url.searchParams.get('search');
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (platform) where.platform = platform;
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (search) {
      where.OR = [
        { topic: { contains: search, mode: 'insensitive' } },
        { client: { name: { contains: search, mode: 'insensitive' } } },
        { client: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [sessions, total] = await Promise.all([
      prisma.videoSession.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true } },
          video: { select: { id: true, title: true, slug: true } },
        },
        orderBy: { scheduledAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.videoSession.count({ where }),
    ]);

    return NextResponse.json({
      sessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('[VideoSessions] List error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video sessions' },
      { status: 500 },
    );
  }
});
