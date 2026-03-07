export const dynamic = 'force-dynamic';

/**
 * Video Session Detail API
 * GET  - Get session details with client, recording, video
 * PUT  - Update session status, link recording/video
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { VideoSessionStatus } from '@prisma/client';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// GET - Session Detail
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (_request: NextRequest, { params }) => {
  try {
    const { id } = params as { id: string };

    const session = await prisma.videoSession.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true, image: true } },
        createdBy: { select: { id: true, name: true } },
        recordingImport: { select: { id: true, status: true, meetingTitle: true, blobUrl: true } },
        video: { select: { id: true, title: true, slug: true, videoUrl: true, status: true } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Video session not found' }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error) {
    logger.error('[VideoSessions] Get error:', error);
    return NextResponse.json({ error: 'Failed to fetch video session' }, { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// PUT - Update Session
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (request: NextRequest, { params }) => {
  try {
    const { id } = params as { id: string };
    const body = await request.json();
    const { status, recordingImportId, videoId, notes } = body as {
      status?: string;
      recordingImportId?: string;
      videoId?: string;
      notes?: string;
    };

    const existing = await prisma.videoSession.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Video session not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    if (status) {
      if (!Object.values(VideoSessionStatus).includes(status as VideoSessionStatus)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updateData.status = status;

      if (status === 'IN_PROGRESS' && !existing.startedAt) {
        updateData.startedAt = new Date();
      }
      if (status === 'COMPLETED' || status === 'CANCELLED') {
        updateData.endedAt = new Date();
      }
    }

    if (recordingImportId !== undefined) updateData.recordingImportId = recordingImportId;
    if (videoId !== undefined) updateData.videoId = videoId;
    if (notes !== undefined) updateData.notes = notes;

    const updated = await prisma.videoSession.update({
      where: { id },
      data: updateData,
      include: {
        client: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        video: { select: { id: true, title: true, slug: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('[VideoSessions] Update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update video session' },
      { status: 500 },
    );
  }
});
