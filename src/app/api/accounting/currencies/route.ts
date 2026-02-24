export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const createCurrencySchema = z.object({
  code: z.string().min(1).max(10),
  name: z.string().min(1),
  symbol: z.string().min(1).max(5),
  exchangeRate: z.number().positive(),
});

const updateCurrencySchema = z.object({
  id: z.string().min(1),
  exchangeRate: z.number().positive().optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/accounting/currencies
 * List all currencies
 */
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const where: Record<string, unknown> = {};
    if (!includeInactive) {
      where.isActive = true;
    }

    const currencies = await prisma.currency.findMany({
      where,
      orderBy: { code: 'asc' },
    });

    const mapped = currencies.map((c) => ({
      ...c,
      exchangeRate: Number(c.exchangeRate),
    }));

    return NextResponse.json({ currencies: mapped });
  } catch (error) {
    logger.error('Get currencies error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des devises' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/accounting/currencies
 * Create a new currency
 */
export const POST = withAdminGuard(async (request) => {
  try {
    // CSRF + Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/currencies');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createCurrencySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { code, name, symbol, exchangeRate } = parsed.data;

    const existing = await prisma.currency.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json(
        { error: `La devise ${code} existe déjà` },
        { status: 409 }
      );
    }

    const currency = await prisma.currency.create({
      data: { code, name, symbol, exchangeRate },
    });

    return NextResponse.json({ success: true, currency }, { status: 201 });
  } catch (error) {
    logger.error('Create currency error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la création de la devise' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/accounting/currencies
 * Update a currency
 */
export const PUT = withAdminGuard(async (request) => {
  try {
    // CSRF + Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/currencies');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateCurrencySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { id, exchangeRate, isActive } = parsed.data;

    const existing = await prisma.currency.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Devise non trouvée' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (exchangeRate !== undefined) {
      updateData.exchangeRate = exchangeRate;
      updateData.rateUpdatedAt = new Date();
    }
    if (isActive !== undefined) updateData.isActive = isActive;

    const currency = await prisma.currency.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, currency });
  } catch (error) {
    logger.error('Update currency error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la devise' },
      { status: 500 }
    );
  }
});
