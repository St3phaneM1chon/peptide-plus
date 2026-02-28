export const dynamic = 'force-dynamic';

/**
 * Admin Video Placements API
 * GET    - List placements for a video
 * POST   - Add a placement
 * DELETE - Remove a placement
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { z } from 'zod';

type RouteContext = { params: Promise<{ id: string }> };

const placementValues = [
  'HOMEPAGE_HERO', 'HOMEPAGE_FEATURED', 'PRODUCT_PAGE', 'VIDEO_LIBRARY',
  'WEBINAR_ARCHIVE', 'LEARNING_CENTER', 'BLOG_EMBED', 'FAQ_SECTION',
  'CUSTOMER_ACCOUNT', 'AMBASSADOR_PAGE', 'CALCULATOR_HELP', 'LAB_RESULTS', 'COMMUNITY',
] as const;

const createPlacementSchema = z.object({
  placement: z.enum(placementValues),
  sortOrder: z.number().int().min(0).max(99999).optional().default(0),
  isActive: z.boolean().optional().default(true),
  contextId: z.string().max(100).optional().nullable(),
  contextType: z.string().max(100).optional().nullable(),
});

const deletePlacementSchema = z.object({
  placementId: z.string().min(1),
});

// GET /api/admin/videos/[id]/placements
export const GET = withAdminGuard(async (_request, { routeContext }) => {
  try {
    const { id } = await (routeContext as RouteContext).params;

    const video = await prisma.video.findUnique({ where: { id }, select: { id: true } });
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const placements = await prisma.videoPlacement.findMany({
      where: { videoId: id },
      orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }],
    });

    return NextResponse.json({ placements });
  } catch (error) {
    logger.error('Admin video placements GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// POST /api/admin/videos/[id]/placements
export const POST = withAdminGuard(async (request, { session, routeContext }) => {
  try {
    const { id } = await (routeContext as RouteContext).params;
    const body = await request.json();

    const parsed = createPlacementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }

    const video = await prisma.video.findUnique({ where: { id }, select: { id: true } });
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const { placement, sortOrder, isActive, contextId, contextType } = parsed.data;

    // Check unique constraint
    const existing = await prisma.videoPlacement.findFirst({
      where: { videoId: id, placement, contextId: contextId || null },
    });
    if (existing) {
      return NextResponse.json({ error: 'This placement already exists for this video' }, { status: 409 });
    }

    const created = await prisma.videoPlacement.create({
      data: {
        videoId: id,
        placement,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
        contextId: contextId || null,
        contextType: contextType || null,
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'ADD_VIDEO_PLACEMENT',
      targetType: 'VideoPlacement',
      targetId: created.id,
      newValue: { videoId: id, placement, contextId },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ placement: created }, { status: 201 });
  } catch (error) {
    logger.error('Admin video placements POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// DELETE /api/admin/videos/[id]/placements
export const DELETE = withAdminGuard(async (request, { session, routeContext }) => {
  try {
    const { id } = await (routeContext as RouteContext).params;
    const body = await request.json();

    const parsed = deletePlacementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }

    const placement = await prisma.videoPlacement.findFirst({
      where: { id: parsed.data.placementId, videoId: id },
    });
    if (!placement) {
      return NextResponse.json({ error: 'Placement not found' }, { status: 404 });
    }

    await prisma.videoPlacement.delete({ where: { id: parsed.data.placementId } });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'REMOVE_VIDEO_PLACEMENT',
      targetType: 'VideoPlacement',
      targetId: parsed.data.placementId,
      previousValue: { videoId: id, placement: placement.placement, contextId: placement.contextId },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Admin video placements DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
