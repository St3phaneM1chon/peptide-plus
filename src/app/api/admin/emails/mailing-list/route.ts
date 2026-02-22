export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status'); // 'active' | 'inactive' | null

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;

    const [subscribers, total] = await Promise.all([
      prisma.newsletterSubscriber.findMany({
        where,
        orderBy: { subscribedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.newsletterSubscriber.count({ where }),
    ]);

    return NextResponse.json({
      subscribers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[MailingList] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { email, name, locale, source } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // RGPD compliance: check if subscriber previously unsubscribed
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email: normalizedEmail },
      select: { isActive: true, unsubscribedAt: true },
    });

    if (existing && !existing.isActive && existing.unsubscribedAt) {
      return NextResponse.json(
        { error: 'This email has previously unsubscribed. A new opt-in is required (RGPD).' },
        { status: 409 },
      );
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

    return NextResponse.json({ success: true, subscriber });
  } catch (error) {
    console.error('[MailingList] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
