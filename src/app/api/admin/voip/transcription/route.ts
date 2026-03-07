export const dynamic = 'force-dynamic';

/**
 * Admin VoIP Transcription API
 * GET /api/admin/voip/transcription?callId=xxx&since=timestamp
 *
 * Returns live transcription lines for an active call.
 * Called by Softphone.tsx when captions (CC) are enabled.
 * Delegates to streaming-transcription lib when available.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = request.nextUrl;
    const callId = searchParams.get('callId');
    const since = searchParams.get('since');

    if (!callId) {
      return NextResponse.json({ error: 'callId required' }, { status: 400 });
    }

    // Fetch transcript events from the streaming-transcription in-memory store
    const sinceTs = since ? Number(since) : 0;
    const sseRes = await fetch(
      `${request.nextUrl.origin}/api/voip/streaming-transcription?callId=${encodeURIComponent(callId)}`,
      {
        headers: {
          Accept: 'text/event-stream',
          Cookie: request.headers.get('cookie') || '',
        },
        signal: AbortSignal.timeout(2000),
      },
    ).catch(() => null);

    if (sseRes?.ok) {
      // Read accumulated text from the SSE body (first chunk)
      const text = await sseRes.text().catch(() => '');
      const lines: string[] = [];
      for (const raw of text.split('\n')) {
        if (!raw.startsWith('data: ')) continue;
        try {
          const evt = JSON.parse(raw.slice(6));
          if (evt.type === 'final' && evt.text && evt.timestamp >= sinceTs) {
            lines.push(evt.text);
          }
        } catch {
          // skip malformed
        }
      }
      return NextResponse.json({
        callId,
        since: sinceTs,
        lines,
        hasMore: false,
      });
    }

    // Fallback: no streaming data available
    return NextResponse.json({
      callId,
      since: sinceTs,
      lines: [],
      hasMore: false,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch transcription' }, { status: 500 });
  }
});
