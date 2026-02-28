export const dynamic = 'force-dynamic';

/**
 * OAuth Callback
 * GET - Handle OAuth redirect from platform, exchange code for tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { handleCallback, type Platform, SUPPORTED_PLATFORMS } from '@/lib/platform/oauth';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ platform: string }> };

export async function GET(request: NextRequest, context: RouteParams) {
  const { platform } = await context.params;

  if (!SUPPORTED_PLATFORMS.some((sp) => sp.id === platform)) {
    return NextResponse.redirect(new URL('/admin/media/connections?error=invalid_platform', request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    logger.warn(`[OAuth Callback] ${platform} returned error:`, error);
    return NextResponse.redirect(
      new URL(`/admin/media/connections?error=${encodeURIComponent(error)}&platform=${platform}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(`/admin/media/connections?error=no_code&platform=${platform}`, request.url)
    );
  }

  // Get current user ID
  const session = await auth();
  const userId = session?.user?.id;

  const result = await handleCallback(platform as Platform, code, userId);

  if (result.success) {
    return NextResponse.redirect(
      new URL(`/admin/media/connections?connected=${platform}`, request.url)
    );
  }

  return NextResponse.redirect(
    new URL(`/admin/media/connections?error=${encodeURIComponent(result.error || 'unknown')}&platform=${platform}`, request.url)
  );
}
