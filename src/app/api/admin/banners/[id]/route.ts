export const dynamic = 'force-dynamic';

/**
 * Admin Banner (Hero Slide) Detail API
 * GET    - Get a single banner with translations
 * PATCH  - Update a banner
 * DELETE - Delete a banner and its translations
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const updateBannerSchema = z.object({
  slug: z.string().max(200).optional(),
  mediaType: z.enum(['IMAGE', 'VIDEO', 'ANIMATION']).optional(),
  backgroundUrl: z.string().min(1).optional(),
  backgroundMobile: z.string().optional().nullable(),
  overlayOpacity: z.number().int().min(0).max(100).optional(),
  overlayGradient: z.string().optional().nullable(),
  badgeText: z.string().max(100).optional().nullable(),
  title: z.string().min(1).max(500).optional(),
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

// GET /api/admin/banners/[id]
export const GET = withAdminGuard(async (_request, { params }) => {
  try {
    const id = params!.id;

    const banner = await prisma.heroSlide.findUnique({
      where: { id },
      include: { translations: true },
    });

    if (!banner) {
      return NextResponse.json({ error: 'Banner not found' }, { status: 404 });
    }

    return NextResponse.json({ data: banner });
  } catch (error) {
    logger.error('Admin banner GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// PATCH /api/admin/banners/[id]
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();
    const parsed = updateBannerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const existing = await prisma.heroSlide.findUnique({
      where: { id },
      select: { id: true, title: true, slug: true, isActive: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Banner not found' }, { status: 404 });
    }

    const data = parsed.data;
    const updateData: Record<string, unknown> = {};

    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.mediaType !== undefined) updateData.mediaType = data.mediaType;
    if (data.backgroundUrl !== undefined) updateData.backgroundUrl = data.backgroundUrl;
    if (data.backgroundMobile !== undefined) updateData.backgroundMobile = data.backgroundMobile || null;
    if (data.overlayOpacity !== undefined) updateData.overlayOpacity = data.overlayOpacity;
    if (data.overlayGradient !== undefined) updateData.overlayGradient = data.overlayGradient || null;
    if (data.badgeText !== undefined) updateData.badgeText = data.badgeText || null;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle || null;
    if (data.ctaText !== undefined) updateData.ctaText = data.ctaText || null;
    if (data.ctaUrl !== undefined) updateData.ctaUrl = data.ctaUrl || null;
    if (data.ctaStyle !== undefined) updateData.ctaStyle = data.ctaStyle || 'primary';
    if (data.cta2Text !== undefined) updateData.cta2Text = data.cta2Text || null;
    if (data.cta2Url !== undefined) updateData.cta2Url = data.cta2Url || null;
    if (data.cta2Style !== undefined) updateData.cta2Style = data.cta2Style || 'outline';
    if (data.statsJson !== undefined) updateData.statsJson = data.statsJson || null;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;

    const banner = await prisma.heroSlide.update({
      where: { id },
      data: updateData,
      include: { translations: true },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_BANNER',
      targetType: 'HeroSlide',
      targetId: id,
      previousValue: { title: existing.title, slug: existing.slug, isActive: existing.isActive },
      newValue: updateData,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ data: banner });
  } catch (error) {
    logger.error('Admin banner PATCH error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// DELETE /api/admin/banners/[id]
export const DELETE = withAdminGuard(async (_request, { session, params }) => {
  try {
    const id = params!.id;

    const existing = await prisma.heroSlide.findUnique({
      where: { id },
      select: { id: true, title: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Banner not found' }, { status: 404 });
    }

    // Delete translations first, then the banner
    await prisma.$transaction(async (tx) => {
      await tx.heroSlideTranslation.deleteMany({ where: { slideId: id } });
      await tx.heroSlide.delete({ where: { id } });
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_BANNER',
      targetType: 'HeroSlide',
      targetId: id,
      previousValue: { title: existing.title },
      ipAddress: getClientIpFromRequest(_request),
      userAgent: _request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Admin banner DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
