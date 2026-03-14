export const dynamic = 'force-dynamic';

/**
 * Recording Stream API
 * GET - Stream a recording audio file
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { getDualChannelRecording } from '@/lib/voip/recording';
import { AuditLogger } from '@/lib/voip/audit-log';
import { getClientIpFromRequest } from '@/lib/admin-audit';

// Shared audit logger instance for recording access events
const auditLogger = new AuditLogger({ flushSize: 10, flushIntervalMs: 60_000 });

export const GET = withAdminGuard(async (
  request: NextRequest,
  { session }: { session: { user: { id: string; name?: string | null } } }
) => {
  // Extract ID from URL path
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  const id = segments[segments.length - 1];

  if (!id) {
    return NextResponse.json({ error: 'Recording ID required' }, { status: 400 });
  }

  const recording = await prisma.callRecording.findUnique({
    where: { id },
    select: {
      blobUrl: true,
      format: true,
      fileSize: true,
      durationSec: true,
      callLog: {
        select: {
          callerNumber: true,
          calledNumber: true,
          startedAt: true,
        },
      },
    },
  });

  if (!recording) {
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
  }

  // Determine download action from query param (?download=true)
  const isDownload = url.searchParams.get('download') === 'true';
  const auditAction = isDownload ? 'recording.download' : 'recording.play';

  // If blobUrl is missing, try fetching from Telnyx dual-channel recording API
  let blobUrl = recording.blobUrl;
  if (!blobUrl) {
    const dualResult = await getDualChannelRecording(id);
    blobUrl = dualResult?.channels.mixed || null;
  }

  if (!blobUrl) {
    // Log denied access attempt
    await auditLogger.log({
      userId: session.user.id,
      userName: session.user.name || undefined,
      action: auditAction,
      resource: 'CallRecording',
      resourceId: id,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
      result: 'failure',
      details: { reason: 'Recording not uploaded yet' },
    });
    return NextResponse.json({ error: 'Recording not uploaded yet' }, { status: 404 });
  }

  // Proxy the audio from Azure Blob
  try {
    const audioResponse = await fetch(blobUrl);
    if (!audioResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch recording' }, { status: 502 });
    }

    // Log successful recording access (HIPAA audit trail)
    await auditLogger.log({
      userId: session.user.id,
      userName: session.user.name || undefined,
      action: auditAction,
      resource: 'CallRecording',
      resourceId: id,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
      result: 'success',
      details: {
        format: recording.format,
        durationSec: recording.durationSec,
        callerNumber: recording.callLog?.callerNumber,
      },
    });

    const contentType = recording.format === 'mp3' ? 'audio/mpeg' : 'audio/wav';

    return new NextResponse(audioResponse.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': recording.fileSize?.toString() || '',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Stream error' }, { status: 500 });
  }
}, { skipCsrf: true });
