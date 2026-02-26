export const dynamic = 'force-dynamic';

/**
 * Admin Newsletter Subscribers API
 * GET  - List all newsletter subscribers (from NewsletterSubscriber)
 * POST - Add a single subscriber
 *
 * FIX: FLAW-002 - These routes were missing; the admin page fetched from them but they didn't exist.
 * FIX: SECURITY - POST handler added (was missing, caused 404 from admin emails page)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { addSubscriberSchema } from '@/lib/validations/newsletter';

export const GET = withAdminGuard(async (request: NextRequest, { session: _session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '200', 10)), 500);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status === 'ACTIVE') where.isActive = true;
    else if (status === 'UNSUBSCRIBED') where.unsubscribedAt = { not: null };

    const [subscribers, total] = await Promise.all([
      prisma.newsletterSubscriber.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          locale: true,
          source: true,
          isActive: true,
          subscribedAt: true,
          unsubscribedAt: true,
        },
        orderBy: { subscribedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.newsletterSubscriber.count({ where }),
    ]);

    const formatted = subscribers.map((sub) => ({
      id: sub.id,
      email: sub.email,
      name: sub.name,
      locale: sub.locale || 'fr',
      source: sub.source || 'website',
      status: sub.unsubscribedAt
        ? 'UNSUBSCRIBED'
        : sub.isActive
          ? 'ACTIVE'
          : 'BOUNCED',
      subscribedAt: sub.subscribedAt.toISOString(),
      unsubscribedAt: sub.unsubscribedAt?.toISOString() || null,
    }));

    return NextResponse.json({
      subscribers: formatted,
      total,
      page,
      limit,
    });
  } catch (error) {
    logger.error('Admin newsletter subscribers error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to fetch subscribers', subscribers: [] },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/newsletter/subscribers
 * Add a single subscriber. Used by admin emails page "Add Contact" modal.
 *
 * FIX: SECURITY - This handler was missing, causing 404 when admins tried to add contacts.
 */
export const POST = withAdminGuard(async (request: NextRequest, { session: _session }) => {
  try {
    const body = await request.json();
    const parsed = addSubscriberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, name, source, locale } = parsed.data;

    // Check for existing subscriber
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email },
      select: { id: true, isActive: true, unsubscribedAt: true },
    });

    if (existing) {
      if (existing.isActive && !existing.unsubscribedAt) {
        return NextResponse.json(
          { error: 'This email is already subscribed' },
          { status: 409 }
        );
      }
      // Re-activate previously unsubscribed contact
      const updated = await prisma.newsletterSubscriber.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          unsubscribedAt: null,
          source: source || 'admin',
          locale: locale || 'fr',
          name: name || undefined,
        },
      });
      return NextResponse.json({ subscriber: updated }, { status: 200 });
    }

    const subscriber = await prisma.newsletterSubscriber.create({
      data: {
        email,
        name: name || null,
        source: source || 'admin',
        locale: locale || 'fr',
        isActive: true,
      },
    });

    return NextResponse.json({ subscriber }, { status: 201 });
  } catch (error) {
    logger.error('Admin newsletter subscriber POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to add subscriber' },
      { status: 500 }
    );
  }
});
