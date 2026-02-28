export const dynamic = 'force-dynamic';

/**
 * Recording Imports API
 * GET - List recording imports with filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (platform) {
      where.connection = { platform };
    }

    if (status) {
      where.status = status;
    }

    const [imports, total] = await Promise.all([
      prisma.recordingImport.findMany({
        where,
        include: {
          connection: {
            select: { platform: true },
          },
          video: {
            select: { id: true, title: true, status: true, featuredClientId: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.recordingImport.count({ where }),
    ]);

    // Get consent status for imports that have videos with featuredClients
    const videoIds = imports
      .filter((i) => i.videoId)
      .map((i) => i.videoId as string);

    const consents = videoIds.length > 0
      ? await prisma.siteConsent.findMany({
          where: { videoId: { in: videoIds } },
          select: { videoId: true, status: true },
        })
      : [];

    const consentMap = new Map(consents.map((c) => [c.videoId, c.status]));

    const data = imports.map((imp) => ({
      id: imp.id,
      platform: imp.connection.platform,
      externalId: imp.externalId,
      meetingId: imp.meetingId,
      meetingTitle: imp.meetingTitle,
      meetingDate: imp.meetingDate,
      hostEmail: imp.hostEmail,
      duration: imp.duration,
      status: imp.status,
      error: imp.error,
      videoId: imp.videoId,
      videoTitle: imp.video?.title,
      videoStatus: imp.video?.status,
      hasFeaturedClient: !!imp.video?.featuredClientId,
      consentStatus: imp.videoId ? consentMap.get(imp.videoId) || null : null,
      consentAutoCreated: imp.consentAutoCreated,
      fileSize: imp.fileSize,
      createdAt: imp.createdAt,
    }));

    return NextResponse.json({
      imports: data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error('[RecordingImports] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch imports' }, { status: 500 });
  }
});
