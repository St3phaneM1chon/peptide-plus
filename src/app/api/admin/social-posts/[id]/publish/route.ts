export const dynamic = 'force-dynamic';

/**
 * Publish Social Post Immediately
 * POST - Publishes a post right now
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { publishPost } from '@/lib/social/social-publisher';

type RouteParams = { params: Promise<{ id: string }> };

export const POST = withAdminGuard(async (_request: NextRequest, context: RouteParams) => {
  const { id } = await context.params;

  const result = await publishPost(id);

  if (result.success) {
    return NextResponse.json({
      success: true,
      externalId: result.externalId,
      externalUrl: result.externalUrl,
    });
  }

  return NextResponse.json(
    { success: false, error: result.error },
    { status: 400 }
  );
});
