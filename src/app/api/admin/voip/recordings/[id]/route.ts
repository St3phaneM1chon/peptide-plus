export const dynamic = 'force-dynamic';

/**
 * Recording Stream API
 * GET - Stream a recording audio file
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';

export const GET = withAdminGuard(async (
  request: NextRequest,
  _context
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

  if (!recording.blobUrl) {
    return NextResponse.json({ error: 'Recording not uploaded yet' }, { status: 404 });
  }

  // Proxy the audio from Azure Blob
  try {
    const audioResponse = await fetch(recording.blobUrl);
    if (!audioResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch recording' }, { status: 502 });
    }

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
