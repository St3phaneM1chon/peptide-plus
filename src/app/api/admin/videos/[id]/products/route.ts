export const dynamic = 'force-dynamic';

/**
 * Admin Video-Product Links API
 * GET    - List product links for a video
 * POST   - Link a product to a video
 * DELETE - Unlink a product from a video
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { z } from 'zod';

type RouteContext = { params: Promise<{ id: string }> };

const linkProductSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  sortOrder: z.number().int().min(0).max(99999).optional().default(0),
});

const unlinkProductSchema = z.object({
  productId: z.string().min(1),
});

// GET /api/admin/videos/[id]/products
export const GET = withAdminGuard(async (_request, { routeContext }) => {
  try {
    const { id } = await (routeContext as RouteContext).params;

    const video = await prisma.video.findUnique({ where: { id }, select: { id: true } });
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const links = await prisma.videoProductLink.findMany({
      where: { videoId: id },
      orderBy: { sortOrder: 'asc' },
      include: {
        product: {
          select: { id: true, name: true, slug: true, imageUrl: true, price: true, isActive: true },
        },
      },
    });

    return NextResponse.json({ productLinks: links });
  } catch (error) {
    logger.error('Admin video products GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// POST /api/admin/videos/[id]/products
export const POST = withAdminGuard(async (request, { session, routeContext }) => {
  try {
    const { id } = await (routeContext as RouteContext).params;
    const body = await request.json();

    const parsed = linkProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }

    const { productId, sortOrder } = parsed.data;

    const [video, product] = await Promise.all([
      prisma.video.findUnique({ where: { id }, select: { id: true } }),
      prisma.product.findUnique({ where: { id: productId }, select: { id: true } }),
    ]);
    if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    // Check existing link
    const existing = await prisma.videoProductLink.findUnique({
      where: { videoId_productId: { videoId: id, productId } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Product is already linked to this video' }, { status: 409 });
    }

    const link = await prisma.videoProductLink.create({
      data: { videoId: id, productId, sortOrder: sortOrder ?? 0 },
      include: {
        product: {
          select: { id: true, name: true, slug: true, imageUrl: true, price: true },
        },
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'LINK_VIDEO_PRODUCT',
      targetType: 'VideoProductLink',
      targetId: link.id,
      newValue: { videoId: id, productId },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ productLink: link }, { status: 201 });
  } catch (error) {
    logger.error('Admin video products POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// DELETE /api/admin/videos/[id]/products
export const DELETE = withAdminGuard(async (request, { session, routeContext }) => {
  try {
    const { id } = await (routeContext as RouteContext).params;
    const body = await request.json();

    const parsed = unlinkProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }

    const link = await prisma.videoProductLink.findUnique({
      where: { videoId_productId: { videoId: id, productId: parsed.data.productId } },
    });
    if (!link) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    await prisma.videoProductLink.delete({ where: { id: link.id } });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UNLINK_VIDEO_PRODUCT',
      targetType: 'VideoProductLink',
      targetId: link.id,
      previousValue: { videoId: id, productId: parsed.data.productId },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Admin video products DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
