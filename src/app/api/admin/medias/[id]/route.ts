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

// PATCH /api/admin/medias/[id] - Update media metadata
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();
    const { alt, folder } = body;

    const existing = await prisma.media.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (alt !== undefined) data.alt = alt;
    if (folder !== undefined) data.folder = folder;

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
    console.error('Admin medias PATCH [id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/medias/[id] - Delete a media file
export const DELETE = withAdminGuard(async (_request, { session, params }) => {
  try {
    const id = params!.id;

    const existing = await prisma.media.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    // Try to delete the physical file
    try {
      const filePath = path.join(process.cwd(), 'public', existing.url);
      await unlink(filePath);
    } catch {
      // File might already be deleted or on external storage - continue anyway
      console.warn(`Could not delete physical file for media ${id}: ${existing.url}`);
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
      ipAddress: getClientIpFromRequest(_request),
      userAgent: _request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin medias DELETE [id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
