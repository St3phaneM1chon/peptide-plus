export const dynamic = 'force-dynamic';

/**
 * Video Highlights API
 * POST - Extract highlights from a video
 * Chantier 4.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { getVideoHighlights } from '@/lib/media/video-highlights';

type RouteParams = { params: Promise<{ id: string }> };

export const POST = withAdminGuard(async (_request: NextRequest, context: RouteParams) => {
  const { id } = await context.params;

  const result = await getVideoHighlights(id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ highlights: result.highlights });
});
