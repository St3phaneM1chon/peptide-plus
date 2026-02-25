export const dynamic = 'force-dynamic';

/**
 * Admin Newsletter Subscriber [id] API
 * DELETE - Remove a subscriber
 * PUT - Update subscriber status
 *
 * FIX: FLAW-002 - Route was missing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const DELETE = withAdminGuard(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }>; session: unknown }
  ) => {
    try {
      const { id } = await params;

      await prisma.newsletterSubscriber.delete({
        where: { id },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      logger.error('Admin newsletter subscriber delete error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: 'Failed to delete subscriber' },
        { status: 500 }
      );
    }
  }
);

export const PUT = withAdminGuard(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }>; session: unknown }
  ) => {
    try {
      const { id } = await params;
      const body = await request.json();

      const data: Record<string, unknown> = {};
      if (body.isActive !== undefined) data.isActive = body.isActive;
      if (body.locale) data.locale = body.locale;
      if (body.isActive === false) data.unsubscribedAt = new Date();

      const updated = await prisma.newsletterSubscriber.update({
        where: { id },
        data,
      });

      return NextResponse.json({ subscriber: updated });
    } catch (error) {
      logger.error('Admin newsletter subscriber update error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: 'Failed to update subscriber' },
        { status: 500 }
      );
    }
  }
);
