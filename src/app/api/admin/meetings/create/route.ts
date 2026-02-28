export const dynamic = 'force-dynamic';

/**
 * Meeting Creation API
 * POST - Create a meeting on a platform and send invitation email
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { createPlatformMeeting } from '@/lib/platform/meeting-creation';
import { sendMeetingInvitationEmail } from '@/lib/email/meeting-invitation';
import { SUPPORTED_PLATFORMS, type Platform } from '@/lib/platform/oauth';
import { logger } from '@/lib/logger';

const VIDEO_PLATFORMS = ['zoom', 'teams', 'google-meet', 'webex'];

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { platform, topic, startTime, duration, inviteeEmail, inviteeName } = body as {
      platform?: string;
      topic?: string;
      startTime?: string;
      duration?: number;
      inviteeEmail?: string;
      inviteeName?: string;
    };

    if (!platform || !topic || !startTime) {
      return NextResponse.json(
        { error: 'Missing required fields: platform, topic, startTime' },
        { status: 400 },
      );
    }

    if (!VIDEO_PLATFORMS.includes(platform)) {
      return NextResponse.json(
        { error: `Invalid platform. Supported: ${VIDEO_PLATFORMS.join(', ')}` },
        { status: 400 },
      );
    }

    // Verify platform is in supported list
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
      { error: error instanceof Error ? error.message : 'Failed to create meeting' },
      { status: 500 },
    );
  }
});
