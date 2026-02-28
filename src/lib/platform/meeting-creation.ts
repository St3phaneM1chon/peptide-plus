/**
 * Unified Meeting Creation Service
 * Creates meetings on Zoom, Teams, Google Meet, and Webex
 */

import { getValidAccessToken, type Platform } from './oauth';
import { createMeeting as createZoomMeeting } from '@/lib/integrations/zoom';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateMeetingParams {
  platform: Platform;
  topic: string;
  startTime: string; // ISO 8601
  duration: number;  // minutes
  inviteeEmail?: string;
  inviteeName?: string;
}

export interface MeetingResult {
  meetingId: string;
  hostJoinUrl: string;
  clientJoinUrl: string;
  password?: string;
  platform: Platform;
  topic: string;
  startTime: string;
  duration: number;
}

// ---------------------------------------------------------------------------
// Platform Implementations
// ---------------------------------------------------------------------------

async function createZoom(params: CreateMeetingParams): Promise<MeetingResult> {
  const data = await createZoomMeeting(params.topic, params.startTime, params.duration);

  return {
    meetingId: String(data.id),
    hostJoinUrl: data.start_url,
    clientJoinUrl: data.join_url,
    password: data.password || undefined,
    platform: 'zoom',
    topic: params.topic,
    startTime: params.startTime,
    duration: params.duration,
  };
}

async function createTeams(params: CreateMeetingParams): Promise<MeetingResult> {
  const token = await getValidAccessToken('teams');
  if (!token) throw new Error('Teams not connected or token expired');

  const startDateTime = new Date(params.startTime).toISOString();
  const endDateTime = new Date(new Date(params.startTime).getTime() + params.duration * 60_000).toISOString();

  const res = await fetch('https://graph.microsoft.com/v1.0/me/onlineMeetings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject: params.topic,
      startDateTime,
      endDateTime,
      lobbyBypassSettings: { scope: 'organization' },
      isEntryExitAnnounced: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Teams meeting creation failed: ${res.status} ${err}`);
  }

  const data = await res.json();

  return {
    meetingId: data.id,
    hostJoinUrl: data.joinWebUrl || data.joinUrl,
    clientJoinUrl: data.joinWebUrl || data.joinUrl,
    platform: 'teams',
    topic: params.topic,
    startTime: params.startTime,
    duration: params.duration,
  };
}

async function createGoogleMeet(params: CreateMeetingParams): Promise<MeetingResult> {
  const token = await getValidAccessToken('google-meet');
  if (!token) throw new Error('Google Meet not connected or token expired');

  const startDateTime = new Date(params.startTime).toISOString();
  const endDateTime = new Date(new Date(params.startTime).getTime() + params.duration * 60_000).toISOString();

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: params.topic,
        start: { dateTime: startDateTime },
        end: { dateTime: endDateTime },
        conferenceData: {
          createRequest: {
            requestId: `bcp-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
        ...(params.inviteeEmail
          ? { attendees: [{ email: params.inviteeEmail, displayName: params.inviteeName }] }
          : {}),
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Meet creation failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  const meetUrl = data.conferenceData?.entryPoints?.find(
    (ep: { entryPointType: string }) => ep.entryPointType === 'video',
  )?.uri || data.hangoutLink || '';

  return {
    meetingId: data.id,
    hostJoinUrl: meetUrl,
    clientJoinUrl: meetUrl,
    platform: 'google-meet',
    topic: params.topic,
    startTime: params.startTime,
    duration: params.duration,
  };
}

async function createWebex(params: CreateMeetingParams): Promise<MeetingResult> {
  const token = await getValidAccessToken('webex');
  if (!token) throw new Error('Webex not connected or token expired');

  const start = new Date(params.startTime).toISOString();
  const end = new Date(new Date(params.startTime).getTime() + params.duration * 60_000).toISOString();

  const invitees = params.inviteeEmail
    ? [{ email: params.inviteeEmail, displayName: params.inviteeName || params.inviteeEmail }]
    : [];

  const res = await fetch('https://webexapis.com/v1/meetings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: params.topic,
      start,
      end,
      enabledAutoRecordMeeting: false,
      allowAnyUserToBeCoHost: false,
      invitees,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Webex meeting creation failed: ${res.status} ${err}`);
  }

  const data = await res.json();

  return {
    meetingId: data.id,
    hostJoinUrl: data.webLink || data.hostMeetingJoinUrl,
    clientJoinUrl: data.webLink || data.joinLink,
    password: data.password || undefined,
    platform: 'webex',
    topic: params.topic,
    startTime: params.startTime,
    duration: params.duration,
  };
}

// ---------------------------------------------------------------------------
// Unified Entry Point
// ---------------------------------------------------------------------------

/**
 * Create a meeting on any supported video platform.
 * Returns unified meeting info with host/client join URLs.
 */
export async function createPlatformMeeting(params: CreateMeetingParams): Promise<MeetingResult> {
  logger.info(`[MeetingCreation] Creating ${params.platform} meeting: ${params.topic}`);

  switch (params.platform) {
    case 'zoom':
      return createZoom(params);
    case 'teams':
      return createTeams(params);
    case 'google-meet':
      return createGoogleMeet(params);
    case 'webex':
      return createWebex(params);
    default:
      throw new Error(`Meeting creation not supported for platform: ${params.platform}`);
  }
}
