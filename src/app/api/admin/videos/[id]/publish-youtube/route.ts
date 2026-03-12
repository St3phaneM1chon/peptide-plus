export const dynamic = 'force-dynamic';

/**
 * YouTube Publish API
 * POST - Upload a video to YouTube channel
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { publishToYouTube } from '@/lib/platform/youtube-publish';
import { logger } from '@/lib/logger';

const publishYouTubeSchema = z.object({
  privacyStatus: z.enum(['public', 'unlisted', 'private']).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export const POST = withAdminGuard(async (request: NextRequest, context: RouteParams) => {
  const { id } = await context.params;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = publishYouTubeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { privacyStatus, title, description, tags } = parsed.data;

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
