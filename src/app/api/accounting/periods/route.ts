export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

// ---------------------------------------------------------------------------
// Zod Schema
// ---------------------------------------------------------------------------

const createPeriodSchema = z.object({
  name: z.string().min(1, 'name est requis'),
  code: z.string().min(1, 'code est requis'),
  startDate: z.string().min(1, 'startDate est requis'),
  endDate: z.string().min(1, 'endDate est requis'),
});

/**
 * GET /api/accounting/periods
 * List accounting periods with optional year and status filters
 */
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (year) where.code = { startsWith: `${year}-` };
    if (status) where.status = status;

    const periods = await prisma.accountingPeriod.findMany({
      where,
      orderBy: { code: 'asc' },
    });

    return NextResponse.json({ periods });
  } catch (error) {
    logger.error('Get periods error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la r\u00e9cup\u00e9ration des p\u00e9riodes comptables' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/accounting/periods
 * Create a new accounting period
 */
export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/periods');
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
    const parsed = createPeriodSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { name, code, startDate, endDate } = parsed.data;

    const parsedStart = new Date(startDate);
    const parsedEnd = new Date(endDate);

    if (parsedStart >= parsedEnd) {
      return NextResponse.json(
        { error: 'La date de d\u00e9but doit \u00eatre ant\u00e9rieure \u00e0 la date de fin' },
        { status: 400 }
      );
    }

    // Check for overlapping periods
    const overlapping = await prisma.accountingPeriod.findFirst({
      where: {
        startDate: { lte: parsedEnd },
        endDate: { gte: parsedStart },
      },
    });
    if (overlapping) {
      return NextResponse.json(
        { error: `La p\u00e9riode chevauche une p\u00e9riode existante: ${overlapping.code}` },
        { status: 409 }
      );
    }

    const existing = await prisma.accountingPeriod.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json(
        { error: `La p\u00e9riode ${code} existe d\u00e9j\u00e0` },
        { status: 409 }
      );
    }

    const period = await prisma.accountingPeriod.create({
      data: {
        name,
        code,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'OPEN',
      },
    });

    return NextResponse.json({ success: true, period }, { status: 201 });
  } catch (error) {
    logger.error('Create period error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la cr\u00e9ation de la p\u00e9riode comptable' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/accounting/periods
 * Delete an OPEN accounting period only
 */
export const DELETE = withAdminGuard(async (request: NextRequest) => {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/periods');
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.accountingPeriod.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'P\u00e9riode non trouv\u00e9e' }, { status: 404 });
    }

    if (existing.status !== 'OPEN') {
      return NextResponse.json(
        { error: 'Seules les p\u00e9riodes ouvertes (OPEN) peuvent \u00eatre supprim\u00e9es' },
        { status: 400 }
      );
    }

    await prisma.accountingPeriod.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'P\u00e9riode comptable supprim\u00e9e' });
  } catch (error) {
    logger.error('Delete period error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la p\u00e9riode comptable' },
      { status: 500 }
    );
  }
});
