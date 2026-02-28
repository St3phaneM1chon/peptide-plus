export const dynamic = 'force-dynamic';

/**
 * Hashtag Suggestions API
 * C-21: AI-powered hashtag suggestions for social posts.
 * POST /api/admin/social-posts/hashtags
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { suggestHashtags, formatHashtags } from '@/lib/social/hashtag-suggestions';
import { z } from 'zod';

const schema = z.object({
  content: z.string().min(1).max(10000),
  platform: z.string().min(1).max(50),
  maxResults: z.number().int().min(1).max(30).optional(),
});

export const POST = withAdminGuard(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
  }

  const suggestions = suggestHashtags(parsed.data.content, parsed.data.platform, {
    maxResults: parsed.data.maxResults,
  });

  return NextResponse.json({
    suggestions,
    formatted: formatHashtags(suggestions),
    count: suggestions.length,
  });
});
