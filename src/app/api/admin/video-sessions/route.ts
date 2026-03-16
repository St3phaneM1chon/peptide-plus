export const dynamic = 'force-dynamic';

/**
 * Video Sessions API
 * POST - Create a video session with a client (creates platform meeting + saves session)
 * GET  - List video sessions with filters and pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma, VideoSessionStatus } from '@prisma/client';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { createPlatformMeeting } from '@/lib/platform/meeting-creation';
import { sendMeetingInvitationEmail } from '@/lib/email/meeting-invitation';
import { type Platform } from '@/lib/platform/oauth';
import { logger } from '@/lib/logger';

const VIDEO_PLATFORMS = ['zoom', 'teams', 'google-meet', 'webex'] as const;

// ---------------------------------------------------------------------------
// POST - Create Video Session
// ---------------------------------------------------------------------------

const createSessionSchema = z.object({
  platform: z.enum(VIDEO_PLATFORMS),
  topic: z.string().min(1).max(500).trim(),
  contentType: z.string().max(50).optional(),
  clientId: z.string().max(200).optional(),
  scheduledAt: z.string().datetime().optional(),
  duration: z.number().int().min(5).max(480).optional(),
  notes: z.string().max(5000).optional(),
  startNow: z.boolean().optional(),
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();
    const parsed = createSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error' },
        { status: 400 }
      );
    }
    const {
      platform,
      topic,
      contentType,
      clientId,
      scheduledAt,
      duration,
      notes,
      startNow,
    } = parsed.data;

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
      select: {
        id: true,
        platform: true,
        topic: true,
        contentType: true,
        status: true,
        scheduledAt: true,
        duration: true,
        startedAt: true,
        meetingId: true,
        clientJoinUrl: true,
        clientId: true,
        createdById: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
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

    // meeting object: strip sensitive fields (password, hostJoinUrl)
    const { password: _mPwd, hostJoinUrl: _mHostUrl, ...safeMeeting } = meeting;

    return NextResponse.json({
      session: videoSession,
      meeting: safeMeeting,
      email: emailResult
        ? { sent: emailResult.success, error: emailResult.error }
        : null,
    }, { status: 201 });
  } catch (error) {
    logger.error('[VideoSessions] Create error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
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

    const where: Prisma.VideoSessionWhereInput = {};
    if (platform) where.platform = platform;
    if (status) where.status = status as VideoSessionStatus;
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
        select: {
          id: true,
          platform: true,
          topic: true,
          contentType: true,
          status: true,
          scheduledAt: true,
          duration: true,
          startedAt: true,
          endedAt: true,
          meetingId: true,
          clientJoinUrl: true,
          clientId: true,
          createdById: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
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
