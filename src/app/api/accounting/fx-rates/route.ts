export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { updateExchangeRates } from '@/lib/exchange-rates';
import { getExchangeRate, type FXRate } from '@/lib/accounting/forex-service';

// ---------------------------------------------------------------------------
// Bank of Canada supported pairs (CAD-based)
// ---------------------------------------------------------------------------
const BOC_PAIRS: Array<{ from: string; to: string }> = [
  { from: 'USD', to: 'CAD' },
  { from: 'EUR', to: 'CAD' },
  { from: 'GBP', to: 'CAD' },
  { from: 'JPY', to: 'CAD' },
  { from: 'CHF', to: 'CAD' },
  { from: 'AUD', to: 'CAD' },
];

/**
 * GET /api/accounting/fx-rates
 * Return current exchange rates -- live from Bank of Canada + cached DB rates.
 * Combines live API data with stored Currency records to provide trend info.
 */
export const GET = withAdminGuard(async () => {
  try {
    // 1. Fetch DB currencies (stored rates + last update timestamps)
    const dbCurrencies = await prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });

    // 2. Fetch live rates from Bank of Canada for known pairs
    const liveRates: Record<string, FXRate> = {};
    const livePromises = BOC_PAIRS.map(async (pair) => {
      try {
        const rate = await getExchangeRate(pair.from, pair.to);
        liveRates[pair.from] = rate;
      } catch {
        // Live rate unavailable -- will fall back to DB value
      }
    });
    await Promise.all(livePromises);

    // 3. Build response with trend calculation
    const rates = dbCurrencies
      .filter((c) => c.code !== 'CAD')
      .map((c) => {
        const dbRate = Number(c.exchangeRate);
        const live = liveRates[c.code];
        const currentRate = live?.rate ?? dbRate;

        // Trend: compare live rate with stored DB rate
        let trend: 'UP' | 'DOWN' | 'STABLE' = 'STABLE';
        let change24h = 0;

        if (live && dbRate > 0) {
          const diff = currentRate - dbRate;
          change24h = Math.round((diff / dbRate) * 10000) / 100; // percentage with 2 decimals
          if (change24h > 0.01) trend = 'UP';
          else if (change24h < -0.01) trend = 'DOWN';
        }

        return {
          code: c.code,
          name: c.name,
          symbol: c.symbol,
          rate: currentRate,
          dbRate,
          trend,
          change24h,
          source: live?.source ?? 'database',
          lastUpdated: live?.timestamp ?? c.rateUpdatedAt,
          rateUpdatedAt: c.rateUpdatedAt,
        };
      });

    return NextResponse.json({
      rates,
      fetchedAt: new Date().toISOString(),
      liveCount: Object.keys(liveRates).length,
      dbCount: dbCurrencies.length,
    });
  } catch (error) {
    logger.error('GET /api/accounting/fx-rates error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des taux de change' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/accounting/fx-rates
 * Trigger a manual sync of FX rates to the Currency table.
 * Re-uses the shared updateExchangeRates() from lib/exchange-rates.ts.
 */
export const POST = withAdminGuard(async (request) => {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/fx-rates');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    logger.info('[fx-rates] Manual sync triggered');

    const result = await updateExchangeRates();

    logger.info('[fx-rates] Manual sync completed', {
      updated: result.updated.length,
      skipped: result.skipped.length,
      errors: result.errors.length,
    });

    return NextResponse.json({
      ...result,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('POST /api/accounting/fx-rates error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la synchronisation des taux de change' },
      { status: 500 }
    );
  }
});
