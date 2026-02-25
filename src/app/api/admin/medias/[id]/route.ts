export const dynamic = 'force-dynamic';

/**
 * Admin Media Detail API
 * PATCH  - Update media metadata (alt text, folder)
 * DELETE - Delete a media file
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { unlink } from 'fs/promises';
import path from 'path';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

const patchMediaSchema = z.object({
  alt: z.string().max(500).optional(),
  folder: z.string().max(200).optional(),
});

// F21 FIX: Sanitize folder path to prevent path traversal
function sanitizeFolderPath(rawFolder: string): string {
  return rawFolder
    .replace(/\.\./g, '')
    .replace(/[^a-zA-Z0-9_\-\/]/g, '')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '');
}

// PATCH /api/admin/medias/[id] - Update media metadata
export const PATCH = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/admin/medias/[id]');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const id = params!.id;
    const body = await request.json();
    const parsed = patchMediaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { alt, folder: rawFolder } = parsed.data;

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
// F27 FIX: Renamed from _request since this parameter is used (getClientIpFromRequest, validateCsrf)
export const DELETE = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/admin/medias/[id]');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

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
