export const dynamic = 'force-dynamic';

/**
 * Admin SEO Settings API
 * GET - Get all SEO settings (from SiteSetting where module = 'seo')
 * PUT - Save SEO settings (upsert each key)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// GET /api/admin/seo - Get all SEO settings
export const GET = withAdminGuard(async (_request: NextRequest, { session }) => {
  try {
    const settings = await prisma.siteSetting.findMany({
      where: { module: 'seo' },
      orderBy: { key: 'asc' },
    });

    // Convert array of key-value records into a flat object for convenience
    const seoMap: Record<string, string> = {};
    for (const setting of settings) {
      seoMap[setting.key] = setting.value;
    }

    return NextResponse.json({ settings, seoMap });
  } catch (error) {
    logger.error('Admin SEO GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// PUT /api/admin/seo - Save SEO settings (bulk upsert)
export const PUT = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();
    const { settings } = body;

    // settings should be an object like:
    // { "seo_site_name": "BioCycle", "seo_site_url": "https://...", ... }
    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: 'settings object is required' },
        { status: 400 }
      );
    }

    // FLAW-026 FIX: Validate against allowlist of permitted SEO setting keys
    const ALLOWED_SEO_KEYS = [
      'seo_site_name', 'seo_site_url', 'seo_default_title', 'seo_default_description',
      'seo_default_og_image', 'seo_twitter_handle', 'seo_google_verification',
      'seo_bing_verification', 'seo_robots_txt', 'seo_custom_head',
      'seo_canonical_base', 'seo_noindex_default', 'seo_og_type',
      'seo_twitter_card_type', 'seo_favicon_url', 'seo_structured_data',
    ];

    const filteredEntries = Object.entries(settings).filter(([key]) => {
      // Allow known keys or keys starting with 'seo_page_' for per-page overrides
      return ALLOWED_SEO_KEYS.includes(key) || key.startsWith('seo_page_');
    });

    if (filteredEntries.length === 0) {
      return NextResponse.json(
        { error: 'No valid SEO settings keys provided' },
        { status: 400 }
      );
    }

    // FLAW-025 FIX: Wrap all upserts in a transaction for consistency
    const upsertedSettings = await prisma.$transaction(
      filteredEntries.map(([key, value]) =>
        prisma.siteSetting.upsert({
          where: { key },
          update: {
            value: String(value),
            updatedBy: session.user.id,
          },
          create: {
            key,
            value: String(value),
            type: 'text',
            module: 'seo',
            description: `SEO setting: ${key}`,
            updatedBy: session.user.id,
          },
        })
      )
    );

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_SEO_SETTINGS',
      targetType: 'SiteSetting',
      targetId: 'seo',
      newValue: { count: upsertedSettings.length, keys: Object.keys(settings) },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      settings: upsertedSettings,
      count: upsertedSettings.length,
    });
  } catch (error) {
    logger.error('Admin SEO PUT error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
