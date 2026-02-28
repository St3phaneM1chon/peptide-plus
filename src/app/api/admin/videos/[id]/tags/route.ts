export const dynamic = 'force-dynamic';

/**
 * Admin Video Tags API
 * GET - List tags for a video
 * PUT - Replace all tags for a video (normalized)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { z } from 'zod';

type RouteContext = { params: Promise<{ id: string }> };

const updateTagsSchema = z.object({
  tags: z.array(z.string().min(1).max(100)).max(50),
});

// GET /api/admin/videos/[id]/tags
export const GET = withAdminGuard(async (_request, { routeContext }) => {
  try {
    const { id } = await (routeContext as RouteContext).params;

    const video = await prisma.video.findUnique({ where: { id }, select: { id: true } });
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const videoTags = await prisma.videoTag.findMany({
      where: { videoId: id },
      orderBy: { tag: 'asc' },
    });

    return NextResponse.json({ tags: videoTags.map(vt => vt.tag) });
  } catch (error) {
    logger.error('Admin video tags GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// PUT /api/admin/videos/[id]/tags - Replace all tags
export const PUT = withAdminGuard(async (request, { session, routeContext }) => {
  try {
    const { id } = await (routeContext as RouteContext).params;
    const body = await request.json();

    const parsed = updateTagsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }

    const video = await prisma.video.findUnique({ where: { id }, select: { id: true } });
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Get existing tags for audit log
    const existingTags = await prisma.videoTag.findMany({
      where: { videoId: id },
      select: { tag: true },
    });

    // Normalize: trim, lowercase, deduplicate
    const normalizedTags = [...new Set(parsed.data.tags.map(t => t.trim().toLowerCase()).filter(Boolean))];

    // Delete all existing, then create new
    await prisma.videoTag.deleteMany({ where: { videoId: id } });

    if (normalizedTags.length > 0) {
      await prisma.videoTag.createMany({
        data: normalizedTags.map(tag => ({ videoId: id, tag })),
      });
    }

    // Also update the legacy tags field for backward compatibility
    await prisma.video.update({
      where: { id },
      data: { tags: JSON.stringify(normalizedTags) },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_VIDEO_TAGS',
      targetType: 'Video',
      targetId: id,
      previousValue: { tags: existingTags.map(t => t.tag) },
      newValue: { tags: normalizedTags },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ tags: normalizedTags });
  } catch (error) {
    logger.error('Admin video tags PUT error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
