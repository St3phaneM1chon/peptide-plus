export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { addSubscriberSchema } from '@/lib/validations/newsletter';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/newsletter/subscribers
 * List newsletter subscribers with optional filters
 */
export const GET = withAdminGuard(async (request, { session: _session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const isActive = searchParams.get('isActive');
    const locale = searchParams.get('locale');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));

    // Build where clause
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== null && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    if (locale) {
      where.locale = locale;
    }

    const [subscribers, total] = await Promise.all([
      prisma.newsletterSubscriber.findMany({
        where,
        orderBy: { subscribedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.newsletterSubscriber.count({ where }),
    ]);

    // Map to the format the frontend expects (status field derived from isActive/unsubscribedAt)
    const mapped = subscribers.map((s) => ({
      id: s.id,
      email: s.email,
      name: s.name,
      locale: s.locale,
      source: s.source || 'unknown',
      status: !s.isActive
        ? s.unsubscribedAt
          ? 'UNSUBSCRIBED'
          : 'BOUNCED'
        : 'ACTIVE',
      isActive: s.isActive,
      subscribedAt: s.subscribedAt.toISOString(),
      unsubscribedAt: s.unsubscribedAt?.toISOString() || null,
    }));

    return NextResponse.json({
      subscribers: mapped,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Get newsletter subscribers error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error fetching newsletter subscribers' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/newsletter/subscribers
 * Add a new subscriber
 */
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();

    // Validate with Zod
    const parsed = addSubscriberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { email, name, source, locale } = parsed.data;

    // Check for existing subscriber
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email },
    });

    if (existing) {
      // If previously unsubscribed, reactivate
      if (!existing.isActive) {
        const reactivated = await prisma.newsletterSubscriber.update({
          where: { email },
          data: {
            isActive: true,
            unsubscribedAt: null,
            name: name || existing.name,
            source: source || existing.source,
            locale: locale || existing.locale,
          },
        });
        return NextResponse.json(
          { success: true, subscriber: reactivated, reactivated: true },
          { status: 200 }
        );
      }
      return NextResponse.json(
        { error: 'This email is already subscribed' },
        { status: 409 }
      );
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

    logAdminAction({
      adminUserId: session.user.id,
      action: 'CREATE_NEWSLETTER_SUBSCRIBER',
      targetType: 'NewsletterSubscriber',
      targetId: subscriber.id,
      newValue: { email, source: source || 'admin' },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json(
      { success: true, subscriber },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Create newsletter subscriber error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error creating subscriber' },
      { status: 500 }
    );
  }
});
