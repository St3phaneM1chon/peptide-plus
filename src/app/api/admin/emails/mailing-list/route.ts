export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { clearBounceCache } from '@/lib/email/bounce-handler';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { logger } from '@/lib/logger';

const addSubscriberSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().max(200).optional(),
  locale: z.string().max(10).optional(),
  source: z.string().max(100).optional(),
});

const unsuppressSchema = z.object({
  email: z.string().email().max(320),
});

// Escape a CSV field value (handles commas, quotes, newlines)
function csvEscape(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get('format');
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status'); // 'active' | 'inactive' | null
    const subscriberId = url.searchParams.get('subscriberId'); // individual subscriber activity

    // --- Individual subscriber activity log ---
    if (subscriberId) {
      const subscriber = await prisma.newsletterSubscriber.findUnique({
        where: { id: subscriberId },
      });
      if (!subscriber) {
        return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 });
      }

      const [lastEmail, emailsSent, emailsOpened, bounces, consents] = await Promise.all([
        prisma.emailLog.findFirst({
          where: { to: subscriber.email },
          orderBy: { sentAt: 'desc' },
          select: { id: true, subject: true, status: true, sentAt: true },
        }),
        prisma.emailLog.count({ where: { to: subscriber.email } }),
        prisma.emailLog.count({ where: { to: subscriber.email, status: 'opened' } }),
        prisma.emailBounce.findMany({
          where: { email: subscriber.email },
          orderBy: { lastBounce: 'desc' },
          take: 5,
          select: { bounceType: true, reason: true, count: true, lastBounce: true },
        }),
        prisma.consentRecord.findMany({
          where: { email: subscriber.email },
          orderBy: { grantedAt: 'desc' },
          take: 5,
          select: { type: true, source: true, grantedAt: true, revokedAt: true },
        }),
      ]);

      return NextResponse.json({
        subscriber,
        activity: {
          lastEmail,
          openRate: emailsSent > 0 ? Math.round((emailsOpened / emailsSent) * 100) / 100 : null,
          emailsSent,
          emailsOpened,
          bounces,
          consents,
        },
      });
    }

    // --- CSV export mode ---
    if (format === 'csv') {
      const CSV_MAX_ROWS = 50000;
      const csvWhere: Record<string, unknown> = {};
      if (search) {
        csvWhere.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (status === 'active') csvWhere.isActive = true;
      if (status === 'inactive') csvWhere.isActive = false;

      const subscribers = await prisma.newsletterSubscriber.findMany({
        where: csvWhere,
        orderBy: { subscribedAt: 'desc' },
        take: CSV_MAX_ROWS,
        select: { email: true, name: true, locale: true, isActive: true, subscribedAt: true },
      });

      const csvHeader = 'email,name,locale,isActive,subscribedAt';
      const csvRows = subscribers.map((s) =>
        [
          csvEscape(s.email),
          csvEscape(s.name),
          csvEscape(s.locale),
          csvEscape(String(s.isActive)),
          csvEscape(s.subscribedAt?.toISOString()),
        ].join(',')
      );

      const csvContent = [csvHeader, ...csvRows].join('\n');
      const timestamp = new Date().toISOString().slice(0, 10);

      return new Response(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="subscribers-${timestamp}.csv"`,
        },
      });
    }

    // --- List subscribers with aggregate stats ---
    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [subscribers, total, totalActive, totalInactive, recentSubscribers, localeGroups] = await Promise.all([
      prisma.newsletterSubscriber.findMany({
        where,
        orderBy: { subscribedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.newsletterSubscriber.count({ where }),
      prisma.newsletterSubscriber.count({ where: { isActive: true } }),
      prisma.newsletterSubscriber.count({ where: { isActive: false } }),
      prisma.newsletterSubscriber.count({ where: { subscribedAt: { gte: thirtyDaysAgo } } }),
      prisma.newsletterSubscriber.groupBy({
        by: ['locale'],
        _count: { locale: true },
        orderBy: { _count: { locale: 'desc' } },
        take: 5,
      }),
    ]);

    const topLocales = localeGroups.map((g) => ({ locale: g.locale, count: g._count.locale }));

    return NextResponse.json({
      subscribers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: { totalActive, totalInactive, recentSubscribers, topLocales },
    });
  } catch (error) {
    logger.error('[MailingList] GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/admin/emails/mailing-list');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    // CSRF validation
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = addSubscriberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { email, name, locale, source } = parsed.data;

    const normalizedEmail = email.toLowerCase().trim();

    // Security #15: Prevent email enumeration - return generic success for all cases
    // RGPD compliance: check if subscriber previously unsubscribed
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email: normalizedEmail },
      select: { isActive: true, unsubscribedAt: true },
    });

    if (existing && !existing.isActive && existing.unsubscribedAt) {
      // Previously unsubscribed - do NOT reveal this to the caller
      // Return same success shape to prevent email enumeration
      return NextResponse.json({ success: true, message: 'Subscription request processed' });
    }

    const subscriber = await prisma.newsletterSubscriber.upsert({
      where: { email: normalizedEmail },
      create: {
        id: crypto.randomUUID(),
        email: normalizedEmail,
        name: name || null,
        locale: locale || 'fr',
        source: source || 'admin-manual',
        isActive: true,
      },
      update: {
        name: name || undefined,
      },
    });

    // Return generic message (don't expose subscriber details for new vs existing)
    return NextResponse.json({ success: true, message: 'Subscription request processed', id: subscriber.id });
  } catch (error) {
    logger.error('[MailingList] POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// DELETE /api/admin/emails/mailing-list - Un-suppress a bounced email address
export const DELETE = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/admin/emails/mailing-list/delete');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    // CSRF validation
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = unsuppressSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { email } = parsed.data;

    const normalizedEmail = email.toLowerCase().trim();

    // Remove from EmailSuppression table
    const suppression = await prisma.emailSuppression.findUnique({
      where: { email: normalizedEmail },
    });

    if (!suppression) {
      return NextResponse.json({ error: 'Email is not in the suppression list' }, { status: 404 });
    }

    await prisma.emailSuppression.delete({
      where: { email: normalizedEmail },
    });

    // Clear from in-memory bounce cache
    clearBounceCache(normalizedEmail);

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UNSUPPRESS_EMAIL',
      targetType: 'EmailSuppression',
      targetId: suppression.id,
      previousValue: { email: normalizedEmail, reason: suppression.reason, provider: suppression.provider },
      newValue: { removed: true },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Email ${normalizedEmail} has been removed from the suppression list`,
      previousReason: suppression.reason,
    });
  } catch (error) {
    logger.error('[MailingList] DELETE (unsuppress) error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
