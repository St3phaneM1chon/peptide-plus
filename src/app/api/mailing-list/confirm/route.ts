export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.redirect(new URL('/?subscription=error', request.url));
    }

    const subscriber = await prisma.mailingListSubscriber.findUnique({
      where: { confirmToken: token },
    });

    if (!subscriber) {
      return NextResponse.redirect(new URL('/?subscription=invalid', request.url));
    }

    if (subscriber.status === 'ACTIVE') {
      return NextResponse.redirect(new URL('/?subscription=already', request.url));
    }

    const confirmedAt = new Date();
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';

    await prisma.mailingListSubscriber.update({
      where: { id: subscriber.id },
      data: {
        status: 'ACTIVE',
        confirmedAt,
        confirmToken: null, // Invalidate token after use
      },
    });

    // CASL audit log: record confirmation event
    console.log(JSON.stringify({
      event: 'mailing_list_confirmed',
      timestamp: confirmedAt.toISOString(),
      subscriberId: subscriber.id,
      email: subscriber.email.replace(/^(.{2}).*(@.*)$/, '$1***$2'),
      consentDate: subscriber.consentDate?.toISOString(),
      consentIp: subscriber.consentIp,
      confirmIp: ip,
    }));

    return NextResponse.redirect(new URL('/?subscription=confirmed', request.url));
  } catch (error) {
    console.error('Mailing list confirm error:', error);
    return NextResponse.redirect(new URL('/?subscription=error', request.url));
  }
}
