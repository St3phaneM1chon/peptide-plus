export const dynamic = 'force-dynamic';

/**
 * Best Time to Post API
 * C-12: Suggests optimal posting times per platform.
 * GET /api/admin/social-posts/best-time?platform=instagram
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { getBestTimesToPost } from '@/lib/social/best-time';

export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform') || 'instagram';

  const result = await getBestTimesToPost(platform);
  return NextResponse.json({ bestTime: result });
});
