export const dynamic = 'force-dynamic';

/**
 * Mobile Email Message Detail API
 * PUT    /api/email/messages/[id] — Mark email as read/starred
 * DELETE /api/email/messages/[id] — Delete/archive email
 */

import { NextRequest, NextResponse } from 'next/server';
import { withMobileGuard } from '@/lib/mobile-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * PUT — Update email conversation (mark as read, star, etc.)
 */
export const PUT = withMobileGuard(async (request, { session, params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'Email ID required' }, { status: 400 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (typeof body.isRead === 'boolean') {
      updateData.status = body.isRead ? 'OPEN' : 'NEW';
    }

    if (typeof body.isStarred === 'boolean') {
      updateData.priority = body.isStarred ? 'HIGH' : 'NORMAL';
    }

    const updated = await prisma.emailConversation.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      id: updated.id,
      isRead: updated.status !== 'NEW',
      isStarred: updated.priority === 'URGENT' || updated.priority === 'HIGH',
    });
  } catch (error) {
    logger.error('[Email Message] PUT failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to update email' }, { status: 500 });
  }
});

/**
 * DELETE — Close/archive an email conversation.
 */
export const DELETE = withMobileGuard(async (request, { session, params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'Email ID required' }, { status: 400 });
    }

    await prisma.emailConversation.update({
      where: { id },
      data: { status: 'CLOSED' },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error('[Email Message] DELETE failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to delete email' }, { status: 500 });
  }
});
