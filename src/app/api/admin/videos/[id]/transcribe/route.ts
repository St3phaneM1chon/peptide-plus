export const dynamic = 'force-dynamic';

/**
 * Video Transcription API
 * POST - Trigger transcription for a video
 * Chantier 2.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { transcribeVideo } from '@/lib/media/video-transcription';

type RouteParams = { params: Promise<{ id: string }> };

export const POST = withAdminGuard(async (_request: NextRequest, context: RouteParams) => {
  const { id } = await context.params;

  const result = await transcribeVideo(id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    transcript: result.transcript,
    language: result.language,
    duration: result.duration,
  });
});
