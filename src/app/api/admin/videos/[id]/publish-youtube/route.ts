export const dynamic = 'force-dynamic';

/**
 * YouTube Publish API
 * POST - Upload a video to YouTube channel
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { publishToYouTube } from '@/lib/platform/youtube-publish';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ id: string }> };

export const POST = withAdminGuard(async (request: NextRequest, context: RouteParams) => {
  const { id } = await context.params;

  try {
    const body = await request.json().catch(() => ({}));
    const { privacyStatus, title, description, tags } = body as {
      privacyStatus?: 'public' | 'unlisted' | 'private';
      title?: string;
      description?: string;
      tags?: string[];
    };

    const result = await publishToYouTube(id, {
      privacyStatus,
      title,
      description,
      tags,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        youtubeVideoId: result.youtubeVideoId,
        youtubeUrl: result.youtubeUrl,
      });
    }

    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 }
    );
  } catch (error) {
    logger.error(`[YouTube] Publish video ${id} error:`, error);
    return NextResponse.json({ error: 'YouTube publish failed' }, { status: 500 });
  }
});
