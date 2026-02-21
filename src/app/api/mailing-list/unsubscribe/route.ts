export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimitMiddleware } from '@/lib/rate-limiter';

function getIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

function logUnsubscribe(subscriberId: string, email: string, ip: string, method: string) {
  console.log(JSON.stringify({
    event: 'mailing_list_unsubscribed',
    timestamp: new Date().toISOString(),
    subscriberId,
    email: email.replace(/^(.{2}).*(@.*)$/, '$1***$2'),
    ip,
    method,
  }));
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

    logUnsubscribe(subscriber.id, subscriber.email, ip, 'one-click-link');
    return NextResponse.redirect(new URL('/?unsubscribe=success', request.url));
  } catch (error) {
    console.error('Mailing list unsubscribe error:', error);
    return NextResponse.redirect(new URL('/?unsubscribe=error', request.url));
  }
}

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

    const body = await request.json();
    const { email, token } = body;

    if (!email && !token) {
      return NextResponse.json({ error: 'Email or token required' }, { status: 400 });
    }

    const where = token
      ? { unsubscribeToken: token as string }
      : { email: (email as string).toLowerCase() };
    const subscriber = await prisma.mailingListSubscriber.findFirst({ where });

    if (!subscriber) {
      return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 });
    }

    await prisma.mailingListSubscriber.update({
      where: { id: subscriber.id },
      data: {
        status: 'UNSUBSCRIBED',
        unsubscribedAt: new Date(),
      },
    });

    logUnsubscribe(subscriber.id, subscriber.email, ip, 'api-post');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mailing list unsubscribe error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
