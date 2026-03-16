export const dynamic = 'force-dynamic';

/**
 * Video Session Detail API
 * GET  - Get session details with client, recording, video
 * PUT  - Update session status, link recording/video
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const updateSessionSchema = z.object({
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  recordingImportId: z.string().max(200).optional(),
  videoId: z.string().max(200).optional(),
  notes: z.string().max(5000).optional(),
});

// ---------------------------------------------------------------------------
// GET - Session Detail
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (_request: NextRequest, { params }) => {
  try {
    const { id } = params as { id: string };

    const session = await prisma.videoSession.findUnique({
      where: { id },
      select: {
        id: true,
        platform: true,
        topic: true,
        contentType: true,
        status: true,
        scheduledAt: true,
        duration: true,
        startedAt: true,
        endedAt: true,
        meetingId: true,
        hostJoinUrl: true,      // Admin-only: needed for host to join meeting
        clientJoinUrl: true,
        // password deliberately excluded — sensitive field
        clientId: true,
        createdById: true,
        recordingImportId: true,
        videoId: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
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
    const parsed = updateSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error' },
        { status: 400 }
      );
    }
    const { status, recordingImportId, videoId, notes } = parsed.data;

    const existing = await prisma.videoSession.findUnique({
      where: { id },
      select: { id: true, startedAt: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Video session not found' }, { status: 404 });
    }

    const updateData: Prisma.VideoSessionUncheckedUpdateInput = {};

    if (status) {
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
      select: {
        id: true,
        platform: true,
        topic: true,
        contentType: true,
        status: true,
        scheduledAt: true,
        duration: true,
        startedAt: true,
        endedAt: true,
        meetingId: true,
        clientJoinUrl: true,
        // password and hostJoinUrl deliberately excluded — sensitive fields
        clientId: true,
        createdById: true,
        recordingImportId: true,
        videoId: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        client: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        video: { select: { id: true, title: true, slug: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('[VideoSessions] Update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
});
