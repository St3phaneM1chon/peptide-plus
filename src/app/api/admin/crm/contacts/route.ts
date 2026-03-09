export const dynamic = 'force-dynamic';

/**
 * Admin CRM Contacts API
 * GET - List CRM contacts (users + leads) with pagination and search
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const skip = (page - 1) * limit;
    const search = searchParams.get('search');
    const source = searchParams.get('source');

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { contactName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (source) {
      where.source = source;
    }

    const [data, total] = await Promise.all([
      prisma.crmLead.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.crmLead.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    logger.error('Admin CRM contacts GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { requiredPermission: 'crm.contacts.view' });
