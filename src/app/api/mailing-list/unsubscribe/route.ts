export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { logger } from '@/lib/logger';

function getIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

function logUnsubscribe(subscriberId: string, email: string, ip: string, method: string) {
  logger.info('mailing_list_unsubscribed', {
    subscriberId,
    email: email.replace(/^(.{2}).*(@.*)$/, '$1***$2'),
    ip,
    method,
  });
}

// GET - One-click unsubscribe (from email link)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.redirect(new URL('/?unsubscribe=error', request.url));
    }

    const subscriber = await prisma.mailingListSubscriber.findUnique({
      where: { unsubscribeToken: token },
    });

    if (!subscriber) {
      return NextResponse.redirect(new URL('/?unsubscribe=invalid', request.url));
    }

    const ip = getIp(request);
    await prisma.mailingListSubscriber.update({
      where: { id: subscriber.id },
      data: {
        status: 'UNSUBSCRIBED',
        unsubscribedAt: new Date(),
      },
    });

    // Revoke consent records (RGPD Art. 7(3))
    await prisma.consentRecord.updateMany({
      where: {
        email: subscriber.email.toLowerCase(),
        type: { in: ['marketing', 'newsletter'] },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    }).catch((err) => logger.error('Unsubscribe cross-sync failed', { error: err instanceof Error ? err.message : String(err) }));

    // Cross-sync: also unsubscribe from NewsletterSubscriber
    await prisma.newsletterSubscriber.updateMany({
      where: { email: subscriber.email.toLowerCase() },
      data: { unsubscribedAt: new Date() },
    }).catch((err) => logger.error('Unsubscribe cross-sync failed', { error: err instanceof Error ? err.message : String(err) }));

    logUnsubscribe(subscriber.id, subscriber.email, ip, 'one-click-link');
    return NextResponse.redirect(new URL('/?unsubscribe=success', request.url));
  } catch (error) {
    logger.error('Mailing list unsubscribe error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.redirect(new URL('/?unsubscribe=error', request.url));
  }
}

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const unsubscribePostSchema = z.object({
  token: z.string().min(1, 'Token required').max(500),
});

// POST - Unsubscribe via API (from preferences page)
export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 10 per IP per hour to prevent mass unsubscribe attacks
    const ip = getIp(request);
    const rl = await rateLimitMiddleware(ip, '/api/mailing-list/unsubscribe');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // SECURITY: CSRF protection for mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();

    // Validate with Zod
    const parsed = unsubscribePostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { token } = parsed.data;

    const subscriber = await prisma.mailingListSubscriber.findFirst({
      where: { unsubscribeToken: token },
    });

    if (!subscriber) {
      // Return generic success to prevent enumeration
      return NextResponse.json({ success: true });
    }

    await prisma.mailingListSubscriber.update({
      where: { id: subscriber.id },
      data: {
        status: 'UNSUBSCRIBED',
        unsubscribedAt: new Date(),
      },
    });

    // Revoke consent records (RGPD Art. 7(3))
    await prisma.consentRecord.updateMany({
      where: {
        email: subscriber.email.toLowerCase(),
        type: { in: ['marketing', 'newsletter'] },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    }).catch((err) => logger.error('Unsubscribe cross-sync failed', { error: err instanceof Error ? err.message : String(err) }));

    // Cross-sync: also unsubscribe from NewsletterSubscriber if present
    await prisma.newsletterSubscriber.updateMany({
      where: { email: subscriber.email.toLowerCase() },
      data: { unsubscribedAt: new Date() },
    }).catch((err) => logger.error('Unsubscribe cross-sync failed', { error: err instanceof Error ? err.message : String(err) }));

    logUnsubscribe(subscriber.id, subscriber.email, ip, 'api-post');
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Mailing list unsubscribe error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
