/**
 * Recording Import Service
 * Handles fetching recordings from connected platforms, downloading to Azure Blob,
 * creating Video records, and auto-creating consent when clients are detected.
 */

import { prisma } from '@/lib/db';
import { getValidAccessToken, type Platform } from './oauth';
import { logger } from '@/lib/logger';
import { StorageService } from '@/lib/storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecordingInfo {
  externalId: string;
  meetingId?: string;
  meetingTitle?: string;
  meetingDate?: Date;
  hostEmail?: string;
  duration?: number; // seconds
  participants?: Array<{ name?: string; email?: string }>;
  downloadUrl?: string;
  downloadHeaders?: Record<string, string>;
  fileSize?: number;
  transcriptUrl?: string;
}

interface ImportResult {
  success: boolean;
  videoId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Storage (uses StorageService — Azure Blob in prod, local filesystem in dev)
// ---------------------------------------------------------------------------

async function uploadRecording(
  buffer: ArrayBuffer,
  filename: string,
  contentType: string = 'video/mp4'
): Promise<string> {
  const storage = new StorageService();
  const result = await storage.upload(
    Buffer.from(buffer),
    filename,
    contentType,
    { folder: 'recordings' }
  );
  return result.url;
}

// ---------------------------------------------------------------------------
// Platform-Specific Fetchers
// ---------------------------------------------------------------------------

/**
 * Fetch available recordings from Zoom Cloud Recording API
 */
export async function fetchZoomRecordings(
  since?: Date
): Promise<RecordingInfo[]> {
  const token = await getValidAccessToken('zoom');
  if (!token) throw new Error('Zoom not connected');

  const fromDate = since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // last 30 days
  const params = new URLSearchParams({
    from: fromDate.toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
    page_size: '100',
  });

  const res = await fetch(`https://api.zoom.us/v2/users/me/recordings?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Zoom API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const recordings: RecordingInfo[] = [];

  for (const meeting of data.meetings || []) {
    // Get the video recording file (not chat/transcript)
    const videoFile = (meeting.recording_files || []).find(
      (f: { recording_type: string; status: string }) =>
        f.recording_type === 'shared_screen_with_speaker_view' ||
        f.recording_type === 'shared_screen_with_gallery_view' ||
        f.recording_type === 'speaker_view' ||
        f.recording_type === 'gallery_view' ||
        f.recording_type === 'active_speaker'
    );

    if (!videoFile) continue;

    recordings.push({
      externalId: String(videoFile.id || meeting.uuid),
      meetingId: String(meeting.id),
      meetingTitle: meeting.topic,
      meetingDate: new Date(meeting.start_time),
      hostEmail: meeting.host_email,
      duration: meeting.duration ? meeting.duration * 60 : undefined, // Zoom returns minutes
      participants: [], // Would need separate API call
      downloadUrl: videoFile.download_url,
      downloadHeaders: { Authorization: `Bearer ${token}` },
      fileSize: videoFile.file_size,
    });
  }

  return recordings;
}

/**
 * Fetch available recordings from Microsoft Teams via Graph API
 */
export async function fetchTeamsRecordings(
  since?: Date
): Promise<RecordingInfo[]> {
  const token = await getValidAccessToken('teams');
  if (!token) throw new Error('Teams not connected');

  const fromDate = since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const filter = `createdDateTime ge ${fromDate.toISOString()}`;

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/onlineMeetings?$filter=${encodeURIComponent(filter)}&$top=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    throw new Error(`Graph API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const recordings: RecordingInfo[] = [];

  for (const meeting of data.value || []) {
    // Get recordings for each meeting
    try {
      const recRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/onlineMeetings/${meeting.id}/recordings`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!recRes.ok) continue;
      const recData = await recRes.json();

      for (const rec of recData.value || []) {
        recordings.push({
          externalId: rec.id,
          meetingId: meeting.id,
          meetingTitle: meeting.subject || 'Teams Meeting',
          meetingDate: new Date(meeting.startDateTime),
          hostEmail: meeting.participants?.organizer?.upn,
          duration: undefined,
          participants: (meeting.participants?.attendees || []).map(
            (a: { upn?: string; identity?: { displayName?: string } }) => ({
              email: a.upn,
              name: a.identity?.displayName,
            })
          ),
          downloadUrl: rec.content ? `https://graph.microsoft.com/v1.0/me/onlineMeetings/${meeting.id}/recordings/${rec.id}/content` : undefined,
          downloadHeaders: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // Skip meetings without recordings
    }
  }

  return recordings;
}

/**
 * Fetch available recordings from Google Meet via Meet API v2 + Drive
 */
export async function fetchMeetRecordings(
  since?: Date
): Promise<RecordingInfo[]> {
  const token = await getValidAccessToken('google-meet');
  if (!token) throw new Error('Google Meet not connected');

  const fromDate = since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const res = await fetch(
    `https://meet.googleapis.com/v2/conferenceRecords?filter=start_time>="${fromDate.toISOString()}"&pageSize=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    throw new Error(`Google Meet API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const recordings: RecordingInfo[] = [];

  for (const record of data.conferenceRecords || []) {
    // Get recordings for this conference
    try {
      const recRes = await fetch(
        `https://meet.googleapis.com/v2/${record.name}/recordings`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!recRes.ok) continue;
      const recData = await recRes.json();

      for (const rec of recData.recordings || []) {
        // Get Drive file info for download
        const driveFileId = rec.driveDestination?.file;
        let downloadUrl: string | undefined;

        if (driveFileId) {
          downloadUrl = `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`;
        }

        recordings.push({
          externalId: rec.name,
          meetingId: record.name,
          meetingTitle: record.space || 'Google Meet Recording',
          meetingDate: new Date(rec.startTime || record.startTime),
          duration: rec.endTime && rec.startTime
            ? Math.round((new Date(rec.endTime).getTime() - new Date(rec.startTime).getTime()) / 1000)
            : undefined,
          participants: [],
          downloadUrl,
          downloadHeaders: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // Skip conferences without recordings
    }
  }

  return recordings;
}

/**
 * Fetch available recordings from Webex
 */
export async function fetchWebexRecordings(
  since?: Date
): Promise<RecordingInfo[]> {
  const token = await getValidAccessToken('webex');
  if (!token) throw new Error('Webex not connected');

  const fromDate = since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const res = await fetch(
    `https://webexapis.com/v1/recordings?from=${fromDate.toISOString()}&max=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    throw new Error(`Webex API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const recordings: RecordingInfo[] = [];

  for (const rec of data.items || []) {
    // Get temporary download URL
    let downloadUrl: string | undefined;
    try {
      const detailRes = await fetch(
        `https://webexapis.com/v1/recordings/${rec.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (detailRes.ok) {
        const detail = await detailRes.json();
        downloadUrl = detail.temporaryDirectDownloadLinks?.recordingDownloadLink;
      }
    } catch {
      // No download URL available
    }

    recordings.push({
      externalId: rec.id,
      meetingId: rec.meetingId,
      meetingTitle: rec.topic || 'Webex Recording',
      meetingDate: new Date(rec.createTime),
      hostEmail: rec.hostEmail,
      duration: rec.durationSeconds,
      participants: [],
      downloadUrl,
    });
  }

  return recordings;
}

// ---------------------------------------------------------------------------
// Core Import Service
// ---------------------------------------------------------------------------

/**
 * Sync recordings from a platform - fetches available recordings and creates
 * RecordingImport entries for ones not yet imported.
 */
export async function syncRecordings(platform: Platform): Promise<{
  newCount: number;
  totalAvailable: number;
}> {
  const connection = await prisma.platformConnection.findUnique({
    where: { platform },
  });

  if (!connection?.isEnabled) {
    throw new Error(`${platform} is not connected or enabled`);
  }

  // Update sync status
  await prisma.platformConnection.update({
    where: { platform },
    data: { syncStatus: 'syncing', syncError: null },
  });

  try {
    let recordings: RecordingInfo[];

    switch (platform) {
      case 'zoom':
        recordings = await fetchZoomRecordings(connection.lastSyncAt || undefined);
        break;
      case 'teams':
        recordings = await fetchTeamsRecordings(connection.lastSyncAt || undefined);
        break;
      case 'google-meet':
        recordings = await fetchMeetRecordings(connection.lastSyncAt || undefined);
        break;
      case 'webex':
        recordings = await fetchWebexRecordings(connection.lastSyncAt || undefined);
        break;
      default:
        throw new Error(`Sync not supported for ${platform}`);
    }

    // Find which ones are already imported
    const existingIds = new Set(
      (
        await prisma.recordingImport.findMany({
          where: {
            connectionId: connection.id,
            externalId: { in: recordings.map((r) => r.externalId) },
          },
          select: { externalId: true },
        })
      ).map((r) => r.externalId)
    );

    // Create import entries for new recordings
    const newRecordings = recordings.filter((r) => !existingIds.has(r.externalId));

    if (newRecordings.length > 0) {
      await prisma.recordingImport.createMany({
        data: newRecordings.map((r) => ({
          connectionId: connection.id,
          externalId: r.externalId,
          meetingId: r.meetingId,
          meetingTitle: r.meetingTitle,
          meetingDate: r.meetingDate,
          hostEmail: r.hostEmail,
          duration: r.duration,
          participants: r.participants ? JSON.parse(JSON.stringify(r.participants)) : undefined,
          fileSize: r.fileSize,
          status: 'pending',
        })),
        skipDuplicates: true,
      });
    }

    // Update connection
    await prisma.platformConnection.update({
      where: { platform },
      data: {
        syncStatus: 'idle',
        lastSyncAt: new Date(),
        syncError: null,
      },
    });

    return {
      newCount: newRecordings.length,
      totalAvailable: recordings.length,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown sync error';
    await prisma.platformConnection.update({
      where: { platform },
      data: { syncStatus: 'error', syncError: errorMsg },
    });
    throw error;
  }
}

/**
 * Import a specific recording - download file, upload to blob, create Video record.
 */
export async function importRecording(importId: string): Promise<ImportResult> {
  const importRecord = await prisma.recordingImport.findUnique({
    where: { id: importId },
    include: { connection: true },
  });

  if (!importRecord) {
    return { success: false, error: 'Import record not found' };
  }

  if (importRecord.status === 'completed') {
    return { success: true, videoId: importRecord.videoId || undefined };
  }

  const platform = importRecord.connection.platform as Platform;

  // Update status
  await prisma.recordingImport.update({
    where: { id: importId },
    data: { status: 'downloading' },
  });

  try {
    // Re-fetch recording info to get fresh download URL
    let recordings: RecordingInfo[];
    switch (platform) {
      case 'zoom':
        recordings = await fetchZoomRecordings();
        break;
      case 'teams':
        recordings = await fetchTeamsRecordings();
        break;
      case 'google-meet':
        recordings = await fetchMeetRecordings();
        break;
      case 'webex':
        recordings = await fetchWebexRecordings();
        break;
      default:
        throw new Error(`Import not supported for ${platform}`);
    }

    const recording = recordings.find((r) => r.externalId === importRecord.externalId);
    if (!recording?.downloadUrl) {
      throw new Error('Recording download URL not available');
    }

    // Download the recording
    const downloadRes = await fetch(recording.downloadUrl, {
      headers: recording.downloadHeaders || {},
    });

    if (!downloadRes.ok) {
      throw new Error(`Download failed: ${downloadRes.status}`);
    }

    const buffer = await downloadRes.arrayBuffer();
    const fileSize = buffer.byteLength;

    // Upload to Azure Blob
    await prisma.recordingImport.update({
      where: { id: importId },
      data: { status: 'processing' },
    });

    const timestamp = Date.now();
    const filename = `${platform}/${importRecord.meetingId || importRecord.externalId}_${timestamp}.mp4`;
    const blobUrl = await uploadRecording(buffer, filename);

    // Create Video record
    const slug = generateSlug(importRecord.meetingTitle || `${platform}-recording-${timestamp}`);
    const videoSource = mapPlatformToSource(platform);

    const video = await prisma.video.create({
      data: {
        title: importRecord.meetingTitle || `${platform} Recording ${new Date().toISOString().split('T')[0]}`,
        slug,
        videoUrl: blobUrl,
        source: videoSource,
        sourceUrl: recording.downloadUrl,
        contentType: importRecord.connection.defaultContentType,
        visibility: importRecord.connection.defaultVisibility,
        status: 'DRAFT',
        videoCategoryId: importRecord.connection.defaultCategoryId,
        createdById: importRecord.connection.connectedById,
        duration: importRecord.duration ? formatDuration(importRecord.duration) : null,
        platformMeetingId: importRecord.meetingId,
      },
    });

    // Update import record
    await prisma.recordingImport.update({
      where: { id: importId },
      data: {
        status: 'completed',
        videoId: video.id,
        blobUrl,
        fileSize,
        transcriptUrl: recording.transcriptUrl,
      },
    });

    // Auto-detect clients from participants
    const consentCreated = await detectAndCreateConsent(
      importRecord,
      video.id
    );

    if (consentCreated) {
      await prisma.recordingImport.update({
        where: { id: importId },
        data: { consentAutoCreated: true },
      });
    }

    logger.info(`[RecordingImport] Successfully imported ${importId} as video ${video.id}`);
    return { success: true, videoId: video.id };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown import error';
    await prisma.recordingImport.update({
      where: { id: importId },
      data: { status: 'failed', error: errorMsg },
    });
    logger.error(`[RecordingImport] Failed to import ${importId}:`, error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Bulk import multiple recordings.
 */
export async function bulkImportRecordings(importIds: string[]): Promise<{
  succeeded: number;
  failed: number;
  results: ImportResult[];
}> {
  const results: ImportResult[] = [];
  let succeeded = 0;
  let failed = 0;

  // Import sequentially to avoid rate limits
  for (const id of importIds) {
    const result = await importRecording(id);
    results.push(result);
    if (result.success) succeeded++;
    else failed++;
  }

  return { succeeded, failed, results };
}

// ---------------------------------------------------------------------------
// Client Detection & Auto-Consent
// ---------------------------------------------------------------------------

/**
 * Detect if any meeting participants are registered clients/customers and
 * auto-create consent requests.
 */
async function detectAndCreateConsent(
  importRecord: { participants: unknown; meetingTitle: string | null },
  videoId: string
): Promise<boolean> {
  const participants = importRecord.participants as Array<{ name?: string; email?: string }> | null;
  if (!participants?.length) return false;

  const participantEmails = participants
    .map((p) => p.email?.toLowerCase())
    .filter((e): e is string => !!e);

  if (participantEmails.length === 0) return false;

  // Find matching users with CLIENT or CUSTOMER role
  const matchingClients = await prisma.user.findMany({
    where: {
      email: { in: participantEmails },
      role: { in: ['CUSTOMER', 'CLIENT'] as unknown[] as string[] },
    },
    select: { id: true, name: true, email: true },
  });

  if (matchingClients.length === 0) return false;

  // Set the first matched client as featuredClient on the video
  const primaryClient = matchingClients[0];
  await prisma.video.update({
    where: { id: videoId },
    data: { featuredClientId: primaryClient.id },
  });

  // Create consent request for each matched client
  for (const client of matchingClients) {
    const token = generateConsentToken();

    await prisma.siteConsent.create({
      data: {
        clientId: client.id,
        type: 'VIDEO_APPEARANCE',
        status: 'PENDING',
        videoId,
        token,
        requestedAt: new Date(),
      },
    });

    // Send consent request email (async, don't block import)
    try {
      const { sendConsentRequestEmail } = await import('@/lib/consent-email');
      await sendConsentRequestEmail({
        clientName: client.name || client.email,
        clientEmail: client.email,
        consentToken: token,
        videoTitle: importRecord.meetingTitle,
      });
    } catch (emailError) {
      logger.warn(`[RecordingImport] Failed to send consent email to ${client.email}:`, emailError);
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapPlatformToSource(platform: Platform): string {
  const map: Record<Platform, string> = {
    zoom: 'ZOOM',
    teams: 'TEAMS',
    'google-meet': 'GOOGLE_MEET',
    webex: 'WEBEX',
    youtube: 'YOUTUBE',
  };
  return map[platform] || 'OTHER';
}

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
  return `${base}-${Date.now().toString(36)}`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function generateConsentToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 48; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
