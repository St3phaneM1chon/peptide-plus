export const dynamic = 'force-dynamic';

/**
 * OAuth Callback
 * GET - Handle OAuth redirect from platform, exchange code for tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { handleCallback, getPublicBaseUrl, type Platform, SUPPORTED_PLATFORMS } from '@/lib/platform/oauth';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ platform: string }> };

/** Build a redirect URL using the public-facing base (not Azure's internal 0.0.0.0). */
function publicRedirect(path: string): URL {
  return new URL(path, getPublicBaseUrl());
}

export async function GET(request: NextRequest, context: RouteParams) {
  const { platform } = await context.params;

  if (!SUPPORTED_PLATFORMS.some((sp) => sp.id === platform)) {
    return NextResponse.redirect(publicRedirect('/admin/media/connections?error=invalid_platform'));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    logger.warn(`[OAuth Callback] ${platform} returned error:`, error);
    return NextResponse.redirect(
      publicRedirect(`/admin/media/connections?error=${encodeURIComponent(error)}&platform=${platform}`)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      publicRedirect(`/admin/media/connections?error=no_code&platform=${platform}`)
    );
  }

  // Get current user ID
  const session = await auth();
  const userId = session?.user?.id;

  const result = await handleCallback(platform as Platform, code, userId);

  if (result.success) {
    return NextResponse.redirect(
      publicRedirect(`/admin/media/connections?connected=${platform}`)
    );
  }

  return NextResponse.redirect(
    publicRedirect(`/admin/media/connections?error=${encodeURIComponent(result.error || 'unknown')}&platform=${platform}`)
  );
}
