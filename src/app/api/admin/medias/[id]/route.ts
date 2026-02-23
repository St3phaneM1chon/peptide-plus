export const dynamic = 'force-dynamic';

/**
 * Admin Media Detail API
 * PATCH  - Update media metadata (alt text, folder)
 * DELETE - Delete a media file
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { unlink } from 'fs/promises';
import path from 'path';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// F21 FIX: Sanitize folder path to prevent path traversal
function sanitizeFolderPath(rawFolder: string): string {
  return rawFolder
    .replace(/\.\./g, '')
    .replace(/[^a-zA-Z0-9_\-\/]/g, '')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '');
}

// PATCH /api/admin/medias/[id] - Update media metadata
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();
    const { alt, folder: rawFolder } = body;

    const existing = await prisma.media.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (alt !== undefined) data.alt = alt;
    if (rawFolder !== undefined) data.folder = sanitizeFolderPath(String(rawFolder));

    const media = await prisma.media.update({
      where: { id },
      data,
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_MEDIA',
      targetType: 'Media',
      targetId: id,
      previousValue: { alt: existing.alt, folder: existing.folder },
      newValue: data,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ media });
  } catch (error) {
    logger.error('Admin medias PATCH [id] error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/medias/[id] - Delete a media file
export const DELETE = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;

    const existing = await prisma.media.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    // F55 FIX: Handle both local and Azure URLs properly
    try {
      if (existing.url.startsWith('http://') || existing.url.startsWith('https://')) {
        // Azure Blob Storage URL - use storage service to delete
        const { storage } = await import('@/lib/storage');
        await storage.delete(existing.url);
      } else {
        // Local filesystem path
        const filePath = path.join(process.cwd(), 'public', existing.url);
        await unlink(filePath);
      }
    } catch {
      // File might already be deleted or on external storage - continue anyway
      logger.warn(`Could not delete physical file for media ${id}: ${existing.url}`);
    }

    // Delete database record
    await prisma.media.delete({
      where: { id },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_MEDIA',
      targetType: 'Media',
      targetId: id,
      previousValue: { filename: existing.filename, originalName: existing.originalName, url: existing.url },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Admin medias DELETE [id] error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
