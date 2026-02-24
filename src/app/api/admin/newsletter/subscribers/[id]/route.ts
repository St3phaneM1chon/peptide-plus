export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { patchSubscriberSchema } from '@/lib/validations/newsletter';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

/**
 * PATCH /api/admin/newsletter/subscribers/[id]
 * Update a subscriber (toggle isActive, change locale, etc.)
 */
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();

    // Validate with Zod
    const parsed = patchSubscriberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Subscriber not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
      if (!data.isActive) {
        updateData.unsubscribedAt = new Date();
      } else {
        updateData.unsubscribedAt = null;
      }
    }

    if (data.name !== undefined) updateData.name = data.name;
    if (data.locale !== undefined) updateData.locale = data.locale;
    if (data.source !== undefined) updateData.source = data.source;

    const subscriber = await prisma.newsletterSubscriber.update({
      where: { id },
      data: updateData,
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_NEWSLETTER_SUBSCRIBER',
      targetType: 'NewsletterSubscriber',
      targetId: id,
      previousValue: { email: existing.email, isActive: existing.isActive },
      newValue: updateData,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true, subscriber });
  } catch (error) {
    logger.error('Update newsletter subscriber error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error updating subscriber' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/admin/newsletter/subscribers/[id]
 * Remove a subscriber permanently
 */
export const DELETE = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;

    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Subscriber not found' },
        { status: 404 }
      );
    }

    await prisma.newsletterSubscriber.delete({ where: { id } });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_NEWSLETTER_SUBSCRIBER',
      targetType: 'NewsletterSubscriber',
      targetId: id,
      previousValue: { email: existing.email },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Delete newsletter subscriber error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error deleting subscriber' },
      { status: 500 }
    );
  }
});
