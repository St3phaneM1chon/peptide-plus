export const dynamic = 'force-dynamic';

/**
 * Admin Media Detail API
 * PATCH  - Update media metadata (alt text, folder)
 * DELETE - Delete a media file
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { unlink } from 'fs/promises';
import path from 'path';

// PATCH /api/admin/medias/[id] - Update media metadata
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
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

    return NextResponse.json({ media });
  } catch (error) {
    console.error('Admin medias PATCH [id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/medias/[id] - Delete a media file
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin medias DELETE [id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
