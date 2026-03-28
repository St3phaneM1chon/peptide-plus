/**
 * Admin API — Social Commerce
 * GET  /api/admin/social-commerce — feed stats + platform status + shoppable link stats
 * POST /api/admin/social-commerce — create shoppable link
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { getFeedStats } from '@/lib/social-commerce';
import {
  createShoppableLink,
  listShoppableLinks,
  getShoppableLinkStats,
  type SocialPlatform,
} from '@/lib/social-commerce/shoppable-links';
import { logger } from '@/lib/logger';

const CreateLinkSchema = z.object({
  productSlug: z.string().min(1),
  platform: z.enum([
    'instagram', 'facebook', 'tiktok', 'twitter',
    'linkedin', 'pinterest', 'whatsapp', 'email', 'sms', 'other',
  ]),
  campaign: z.string().optional(),
  content: z.string().optional(),
});

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const host = request.headers.get('host') || 'attitudes.vip';
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = `${protocol}://${host}`;

    const [feedStats, linkStats, recentLinks] = await Promise.all([
      getFeedStats(),
      getShoppableLinkStats(),
      listShoppableLinks({ limit: 20 }),
    ]);

    // Platform connection status (config-based, not OAuth — platforms use feed URLs)
    const platforms = [
      {
        id: 'google',
        name: 'Google Merchant Center',
        icon: 'google',
        feedUrl: `${baseUrl}/api/feeds/google`,
        feedFormat: 'XML (RSS 2.0)',
        status: 'active' as const,
        description: 'Google Shopping, Search ads, YouTube Shopping',
      },
      {
        id: 'facebook',
        name: 'Facebook / Instagram Shop',
        icon: 'facebook',
        feedUrl: `${baseUrl}/api/feeds/facebook`,
        feedFormat: 'JSON',
        status: 'active' as const,
        description: 'Facebook Shop, Instagram Shopping, Marketplace',
      },
      {
        id: 'tiktok',
        name: 'TikTok Shop',
        icon: 'tiktok',
        feedUrl: `${baseUrl}/api/feeds/tiktok`,
        feedFormat: 'JSON',
        status: 'active' as const,
        description: 'TikTok Shop product catalog',
      },
    ];

    return NextResponse.json({
      platforms,
      feedStats,
      linkStats,
      recentLinks: recentLinks.map((l) => ({
        ...l,
        shortUrl: `${baseUrl}/s/${l.shortCode}`,
      })),
    });
  } catch (error) {
    logger.error('[SocialCommerce API] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to load social commerce data' },
      { status: 500 }
    );
  }
});

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const data = CreateLinkSchema.parse(body);

    const host = request.headers.get('host') || 'attitudes.vip';
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = `${protocol}://${host}`;

    const link = await createShoppableLink({
      productSlug: data.productSlug,
      platform: data.platform as SocialPlatform,
      campaign: data.campaign,
      content: data.content,
      baseUrl,
    });

    return NextResponse.json({
      link: {
        ...link,
        shortUrl: `${baseUrl}/s/${link.shortCode}`,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    logger.error('[SocialCommerce API] POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create shoppable link' },
      { status: 500 }
    );
  }
});
