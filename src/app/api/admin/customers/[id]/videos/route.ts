export const dynamic = 'force-dynamic';

/**
 * Customer Videos API
 * GET - Fetch all videos for a client, grouped by contentType
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// GET - List videos for a customer, grouped by contentType
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id: clientId } = await params;
    const url = new URL(request.url);
    const contentTypeFilter = url.searchParams.get('contentType');
    const search = url.searchParams.get('search');

    // Verify customer exists
    const customer = await prisma.user.findUnique({
      where: { id: clientId },
      select: { id: true },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 },
      );
    }

    // Build filter for video sessions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionWhere: any = { clientId };
    if (contentTypeFilter) {
      sessionWhere.contentType = contentTypeFilter;
    }
    if (search) {
      sessionWhere.OR = [
        { topic: { contains: search, mode: 'insensitive' } },
        { video: { title: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Build filter for featured videos
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const featuredWhere: any = { featuredClientId: clientId };
    if (contentTypeFilter) {
      featuredWhere.contentType = contentTypeFilter;
    }
    if (search) {
      featuredWhere.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Fetch video sessions (via VideoSession) and featured videos (via Video) in parallel
    const [sessions, featuredVideos] = await Promise.all([
      prisma.videoSession.findMany({
        where: sessionWhere,
        include: {
          video: {
            select: {
              id: true,
              title: true,
              slug: true,
              thumbnailUrl: true,
              videoUrl: true,
              duration: true,
              source: true,
              status: true,
              contentType: true,
              createdAt: true,
            },
          },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { scheduledAt: 'desc' },
      }),
      prisma.video.findMany({
        where: featuredWhere,
        select: {
          id: true,
          title: true,
          slug: true,
          thumbnailUrl: true,
          videoUrl: true,
          duration: true,
          source: true,
          status: true,
          contentType: true,
          createdAt: true,
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Normalize into a flat list of video items
    interface VideoItem {
      id: string;
      type: 'session' | 'featured';
      contentType: string;
      title: string;
      platform: string | null;
      status: string;
      scheduledAt: string | null;
      duration: number | null;
      videoUrl: string | null;
      thumbnailUrl: string | null;
      videoTitle: string | null;
      videoSlug: string | null;
      videoSource: string | null;
      videoStatus: string | null;
      createdBy: { id: string; name: string | null } | null;
      createdAt: string;
    }

    const items: VideoItem[] = [];

    // Add video sessions
    for (const s of sessions) {
      items.push({
        id: s.id,
        type: 'session',
        contentType: s.contentType,
        title: s.topic,
        platform: s.platform,
        status: s.status,
        scheduledAt: s.scheduledAt.toISOString(),
        duration: s.duration,
        videoUrl: s.video?.videoUrl || null,
        thumbnailUrl: s.video?.thumbnailUrl || null,
        videoTitle: s.video?.title || null,
        videoSlug: s.video?.slug || null,
        videoSource: s.video?.source || null,
        videoStatus: s.video?.status || null,
        createdBy: s.createdBy ? { id: s.createdBy.id, name: s.createdBy.name } : null,
        createdAt: s.createdAt.toISOString(),
      });
    }

    // Add featured videos (avoid duplicates: skip if already linked via a session)
    const sessionVideoIds = new Set(sessions.filter(s => s.video).map(s => s.video!.id));
    for (const v of featuredVideos) {
      if (sessionVideoIds.has(v.id)) continue;
      items.push({
        id: v.id,
        type: 'featured',
        contentType: v.contentType,
        title: v.title,
        platform: null,
        status: v.status,
        scheduledAt: null,
        duration: v.duration ? parseDurationToMinutes(v.duration) : null,
        videoUrl: v.videoUrl || null,
        thumbnailUrl: v.thumbnailUrl || null,
        videoTitle: v.title,
        videoSlug: v.slug,
        videoSource: v.source || null,
        videoStatus: v.status,
        createdBy: v.createdBy ? { id: v.createdBy.id, name: v.createdBy.name } : null,
        createdAt: v.createdAt.toISOString(),
      });
    }

    // Group by contentType
    const grouped: Record<string, VideoItem[]> = {};
    for (const item of items) {
      const key = item.contentType || 'OTHER';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    }

    // Sort each group by date descending
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => {
        const dateA = a.scheduledAt || a.createdAt;
        const dateB = b.scheduledAt || b.createdAt;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
    }

    return NextResponse.json({
      grouped,
      totalCount: items.length,
      contentTypes: Object.keys(grouped),
    });
  } catch (error) {
    logger.error('[CustomerVideos] Error fetching videos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer videos' },
      { status: 500 },
    );
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a duration string like "1h 30m" or "45:00" or "30" into minutes */
function parseDurationToMinutes(duration: string): number | null {
  // Try "Xh Ym" format
  const hmMatch = duration.match(/(\d+)\s*h\s*(\d+)?\s*m?/i);
  if (hmMatch) {
    return parseInt(hmMatch[1]) * 60 + (parseInt(hmMatch[2] || '0'));
  }
  // Try "MM:SS" or "HH:MM:SS"
  const parts = duration.split(':');
  if (parts.length === 2) return parseInt(parts[0]);
  if (parts.length === 3) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  // Try plain number (minutes)
  const num = parseInt(duration);
  return isNaN(num) ? null : num;
}
