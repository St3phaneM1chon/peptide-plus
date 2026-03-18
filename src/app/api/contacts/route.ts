export const dynamic = 'force-dynamic';

/**
 * Mobile Contacts API
 * GET /api/contacts — List CRM contacts
 */

import { NextRequest, NextResponse } from 'next/server';
import { withMobileGuard } from '@/lib/mobile-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * GET — List contacts from CRM.
 * Maps CrmLead fields to the Contact format expected by iOS.
 */
export const GET = withMobileGuard(async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};
    if (search) {
      where.OR = [
        { contactName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [contacts, total] = await Promise.all([
      prisma.crmLead.findMany({
        where,
        select: {
          id: true,
          contactName: true,
          email: true,
          phone: true,
          companyName: true,
          source: true,
          status: true,
          tags: true,
          temperature: true,
          score: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.crmLead.count({ where }),
    ]);

    // Map to iOS Contact format
    const mapped = contacts.map(c => ({
      id: c.id,
      email: c.email || '',
      name: c.contactName || '',
      phone: c.phone || null,
      image: null,
      role: 'CUSTOMER',
      createdAt: c.createdAt.toISOString(),
      isBanned: false,
      loyaltyTier: 'BRONZE',
      lifetimePoints: 0,
      addresses: [],
      yearToDateTotal: 0,
      lifetimeTotal: 0,
      orderCount: 0,
      lastOrderDate: null,
      tags: c.tags || [],
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    logger.error('[Contacts] GET failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to list contacts' }, { status: 500 });
  }
});
