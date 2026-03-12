export const dynamic = 'force-dynamic';

/**
 * Meeting Creation API
 * POST - Create a meeting on a platform and send invitation email
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { createPlatformMeeting } from '@/lib/platform/meeting-creation';
import { sendMeetingInvitationEmail } from '@/lib/email/meeting-invitation';
import { SUPPORTED_PLATFORMS, type Platform } from '@/lib/platform/oauth';
import { logger } from '@/lib/logger';

const VIDEO_PLATFORMS = ['zoom', 'teams', 'google-meet', 'webex'] as const;

const createMeetingSchema = z.object({
  platform: z.enum(VIDEO_PLATFORMS),
  topic: z.string().min(1).max(500).trim(),
  startTime: z.string().datetime(),
  duration: z.number().int().min(5).max(480).optional(),
  inviteeEmail: z.string().email().max(320).optional(),
  inviteeName: z.string().max(200).trim().optional(),
});

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = createMeetingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { platform, topic, startTime, duration, inviteeEmail, inviteeName } = parsed.data;

    if (!SUPPORTED_PLATFORMS.some((sp) => sp.id === platform)) {
      return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 });
    }

    const meeting = await createPlatformMeeting({
      platform: platform as Platform,
      topic,
      startTime,
      duration: duration || 30,
      inviteeEmail,
      inviteeName,
    });

    // Send invitation email if invitee provided
    let emailResult = null;
    if (inviteeEmail) {
      emailResult = await sendMeetingInvitationEmail({
        recipientEmail: inviteeEmail,
        recipientName: inviteeName || inviteeEmail,
        topic: meeting.topic,
        startTime: meeting.startTime,
        duration: meeting.duration,
        joinUrl: meeting.clientJoinUrl,
        platform: meeting.platform,
        password: meeting.password,
      });
    }

    return NextResponse.json({
      meeting,
      email: emailResult
        ? { sent: emailResult.success, messageId: emailResult.messageId, error: emailResult.error }
        : null,
    }, { status: 201 });
  } catch (error) {
    logger.error('[MeetingsAPI] Create meeting error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
});
