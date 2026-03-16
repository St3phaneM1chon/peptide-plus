export const dynamic = 'force-dynamic';

/**
 * Admin Banners (Hero Slides) API
 * GET  - List hero slide banners with pagination
 * POST - Create a new hero slide banner
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const createBannerSchema = z.object({
  slug: z.string().max(200).optional(),
  mediaType: z.enum(['IMAGE', 'VIDEO', 'ANIMATION']).optional(),
  backgroundUrl: z.string().min(1, 'Background URL is required'),
  backgroundMobile: z.string().optional().nullable(),
  overlayOpacity: z.number().int().min(0).max(100).optional(),
  overlayGradient: z.string().optional().nullable(),
  badgeText: z.string().max(100).optional().nullable(),
  title: z.string().min(1, 'Title is required').max(500),
  subtitle: z.string().max(2000).optional().nullable(),
  ctaText: z.string().max(200).optional().nullable(),
  ctaUrl: z.string().max(500).optional().nullable(),
  ctaStyle: z.string().max(50).optional().nullable(),
  cta2Text: z.string().max(200).optional().nullable(),
  cta2Url: z.string().max(500).optional().nullable(),
  cta2Style: z.string().max(50).optional().nullable(),
  statsJson: z.string().max(5000).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

// GET /api/admin/banners - List banners
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.heroSlide.findMany({
        take: limit,
        skip,
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          slug: true,
          mediaType: true,
          backgroundUrl: true,
          backgroundMobile: true,
          overlayOpacity: true,
          overlayGradient: true,
          badgeText: true,
          title: true,
          subtitle: true,
          ctaText: true,
          ctaUrl: true,
          ctaStyle: true,
          cta2Text: true,
          cta2Url: true,
          cta2Style: true,
          statsJson: true,
          sortOrder: true,
          isActive: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          updatedAt: true,
          translations: {
            select: {
              id: true,
              locale: true,
              title: true,
              subtitle: true,
              badgeText: true,
              ctaText: true,
              cta2Text: true,
              isApproved: true,
              qualityLevel: true,
            },
          },
        },
      }),
      prisma.heroSlide.count(),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    logger.error('Admin banners GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// POST /api/admin/banners - Create a new banner
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const parsed = createBannerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data' },
        { status: 400 }
      );
    }

    const {
      slug: providedSlug,
      mediaType,
      backgroundUrl,
      backgroundMobile,
      overlayOpacity,
      overlayGradient,
      badgeText,
      title,
      subtitle,
      ctaText,
      ctaUrl,
      ctaStyle,
      cta2Text,
      cta2Url,
      cta2Style,
      statsJson,
      sortOrder,
      isActive,
      startDate,
      endDate,
    } = parsed.data;

    // Generate slug from title if not provided
    const baseSlug = (providedSlug || title)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = baseSlug;
    const existingSlug = await prisma.heroSlide.findUnique({ where: { slug }, select: { id: true } });
    if (existingSlug) {
      const { randomUUID } = await import('crypto');
      slug = `${baseSlug}-${randomUUID().slice(0, 8)}`;
    }

    const banner = await prisma.heroSlide.create({
      data: {
        slug,
        mediaType: mediaType || 'IMAGE',
        backgroundUrl,
        backgroundMobile: backgroundMobile || null,
        overlayOpacity: overlayOpacity ?? 70,
        overlayGradient: overlayGradient || null,
        badgeText: badgeText || null,
        title,
        subtitle: subtitle || null,
        ctaText: ctaText || null,
        ctaUrl: ctaUrl || null,
        ctaStyle: ctaStyle || 'primary',
        cta2Text: cta2Text || null,
        cta2Url: cta2Url || null,
        cta2Style: cta2Style || 'outline',
        statsJson: statsJson || null,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
      include: { translations: true },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'CREATE_BANNER',
      targetType: 'HeroSlide',
      targetId: banner.id,
      newValue: { title, slug: banner.slug, isActive: banner.isActive },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch((err) => { logger.error('[admin/banners] Non-blocking operation failed:', err); });

    return NextResponse.json({ data: banner }, { status: 201 });
  } catch (error) {
    logger.error('Admin banners POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
