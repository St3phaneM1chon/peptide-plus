export const dynamic = 'force-dynamic';

/**
 * CRM Exchange Rates API
 * GET  /api/admin/crm/exchange-rates - List all exchange rates
 * POST /api/admin/crm/exchange-rates - Create or update an exchange rate (upsert)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const upsertRateSchema = z.object({
  fromCurrency: z.string().min(2).max(10).transform(v => v.toUpperCase()),
  toCurrency: z.string().min(2).max(10).transform(v => v.toUpperCase()),
  rate: z.number().positive(),
  source: z.string().max(50).optional().default('manual'),
});

// ---------------------------------------------------------------------------
// GET: List all exchange rates
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const rates = await prisma.exchangeRate.findMany({
      orderBy: [
        { fromCurrency: 'asc' },
        { toCurrency: 'asc' },
      ],
    });

    return apiSuccess(rates, { request });
  } catch (error) {
    logger.error('[crm/exchange-rates] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch exchange rates', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.settings' });

// ---------------------------------------------------------------------------
// POST: Create or update an exchange rate (upsert on unique constraint)
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = upsertRateSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
        request,
        details: parsed.error.flatten(),
      });
    }

    const { fromCurrency, toCurrency, rate, source } = parsed.data;

    if (fromCurrency === toCurrency) {
      return apiError(
        'fromCurrency and toCurrency must be different',
        ErrorCode.VALIDATION_ERROR,
        { status: 400, request }
      );
    }

    const exchangeRate = await prisma.exchangeRate.upsert({
      where: {
        fromCurrency_toCurrency: {
          fromCurrency,
          toCurrency,
        },
      },
      create: {
        fromCurrency,
        toCurrency,
        rate: new Prisma.Decimal(rate),
        source,
        fetchedAt: new Date(),
      },
      update: {
        rate: new Prisma.Decimal(rate),
        source,
        fetchedAt: new Date(),
      },
    });

    logger.info('[crm/exchange-rates] Rate upserted', {
      fromCurrency,
      toCurrency,
      rate,
      source,
    });

    return apiSuccess(exchangeRate, { status: 201, request });
  } catch (error) {
    logger.error('[crm/exchange-rates] POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to upsert exchange rate', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.settings' });
