export const dynamic = 'force-dynamic';

/**
 * CRON Job - FX Rate Sync (Bank of Canada)
 *
 * Fetches latest exchange rates from Bank of Canada Valet API
 * and updates the Currency table in the database.
 *
 * Schedule: Daily at 6 AM EST (after Bank of Canada publishes daily rates)
 * Configuration (vercel.json / Azure cron):
 *   "0 11 * * *"  (11:00 UTC = 6:00 AM EST)
 *
 * Falls back to open.er-api.com if Bank of Canada is unavailable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { withJobLock } from '@/lib/cron-lock';

// Bank of Canada Valet API currency codes
// These map to FX{FROM}{TO} series in the Valet API
const BOC_SERIES: Record<string, string> = {
  USD: 'FXUSDCAD',
  EUR: 'FXEURCAD',
  GBP: 'FXGBPCAD',
  JPY: 'FXJPYCAD',
  CHF: 'FXCHFCAD',
  AUD: 'FXAUDCAD',
  CNY: 'FXCNYCAD',
  MXN: 'FXMXNCAD',
  HKD: 'FXHKDCAD',
  SGD: 'FXSGDCAD',
  SEK: 'FXSEKCAD',
  NOK: 'FXNOKCAD',
  DKK: 'FXDKKCAD',
  INR: 'FXINRCAD',
  KRW: 'FXKRWCAD',
  BRL: 'FXBRLCAD',
  ZAR: 'FXZARCAD',
  SAR: 'FXSARCAD',
};

interface BocObservation {
  d: string; // date YYYY-MM-DD
  [key: string]: { v: string } | string;
}

/**
 * Fetch the latest observation for a set of Bank of Canada series.
 * Uses a single API call for all series to minimise network round-trips.
 */
async function fetchBocRates(): Promise<Record<string, number>> {
  const seriesNames = Object.values(BOC_SERIES).join(',');
  const url = `https://www.bankofcanada.ca/valet/observations/${seriesNames}/json?recent=1`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Bank of Canada API returned ${response.status}`);
  }

  const data = await response.json();
  const observations: BocObservation[] = data?.observations;

  if (!observations || observations.length === 0) {
    throw new Error('Bank of Canada returned no observations');
  }

  const latest = observations[observations.length - 1];
  const rates: Record<string, number> = {};

  for (const [currencyCode, seriesName] of Object.entries(BOC_SERIES)) {
    const obs = latest[seriesName];
    if (obs && typeof obs === 'object' && 'v' in obs) {
      const rate = parseFloat(obs.v);
      if (!isNaN(rate) && rate > 0) {
        rates[currencyCode] = rate;
      }
    }
  }

  return rates;
}

/**
 * Fallback: fetch rates from open.er-api.com (free, no key).
 */
async function fetchFallbackRates(): Promise<Record<string, number>> {
  const response = await fetch('https://open.er-api.com/v6/latest/CAD', {
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`open.er-api.com returned ${response.status}`);
  }

  const data = await response.json();
  if (data.result !== 'success' || !data.rates) {
    throw new Error('open.er-api.com returned invalid data');
  }

  // Rates from this API are CAD-based (1 CAD = X foreign).
  // We need X foreign = Y CAD, so we invert.
  const rates: Record<string, number> = {};
  for (const [code, value] of Object.entries(data.rates)) {
    const numVal = Number(value);
    if (code !== 'CAD' && numVal > 0) {
      rates[code] = Math.round((1 / numVal) * 1000000) / 1000000;
    }
  }

  return rates;
}

/**
 * Core sync logic: fetch rates and update Currency table.
 */
async function syncFxRates(): Promise<{
  success: boolean;
  source: string;
  updated: Array<{ code: string; oldRate: number; newRate: number }>;
  skipped: string[];
  errors: string[];
  fetchedAt: string;
}> {
  const updated: Array<{ code: string; oldRate: number; newRate: number }> = [];
  const skipped: string[] = [];
  const errors: string[] = [];
  let source = 'bank_of_canada';

  // 1. Fetch live rates (Bank of Canada primary, open.er-api fallback)
  let rates: Record<string, number>;
  try {
    rates = await fetchBocRates();
    logger.info('[fx-rate-sync] Fetched rates from Bank of Canada', {
      count: Object.keys(rates).length,
    });
  } catch (bocError) {
    logger.warn('[fx-rate-sync] Bank of Canada unavailable, trying fallback', {
      error: bocError instanceof Error ? bocError.message : String(bocError),
    });
    try {
      rates = await fetchFallbackRates();
      source = 'open.er-api.com';
      logger.info('[fx-rate-sync] Fetched rates from fallback API', {
        count: Object.keys(rates).length,
      });
    } catch (fallbackError) {
      throw new Error(
        `Both rate sources failed. BoC: ${bocError instanceof Error ? bocError.message : String(bocError)}. Fallback: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
      );
    }
  }

  // 2. Load active currencies from DB
  const currencies = await prisma.currency.findMany({
    where: { isActive: true },
  });

  // 3. Update each currency
  const now = new Date();

  for (const currency of currencies) {
    try {
      if (currency.isDefault || currency.code === 'CAD') {
        skipped.push(currency.code);
        continue;
      }

      const newRate = rates[currency.code];
      if (newRate === undefined) {
        skipped.push(currency.code);
        continue;
      }

      const oldRate = Number(currency.exchangeRate);

      // Skip if rate hasn't changed (within 6-decimal precision)
      if (Math.abs(oldRate - newRate) < 0.000001) {
        skipped.push(currency.code);
        continue;
      }

      await prisma.currency.update({
        where: { id: currency.id },
        data: {
          exchangeRate: newRate,
          rateUpdatedAt: now,
        },
      });

      updated.push({ code: currency.code, oldRate, newRate });

      logger.info('[fx-rate-sync] Rate updated', {
        code: currency.code,
        oldRate: oldRate.toFixed(6),
        newRate: newRate.toFixed(6),
        change: ((newRate - oldRate) / oldRate * 100).toFixed(4) + '%',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`${currency.code}: ${msg}`);
      logger.error('[fx-rate-sync] Failed to update currency', {
        code: currency.code,
        error: msg,
      });
    }
  }

  return {
    success: true,
    source,
    updated,
    skipped,
    errors,
    fetchedAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Verify cron secret (timing-safe)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const providedSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  let secretsMatch = false;
  try {
    const a = Buffer.from(cronSecret, 'utf8');
    const b = Buffer.from(providedSecret, 'utf8');
    secretsMatch = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    secretsMatch = false;
  }

  if (!secretsMatch) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return withJobLock('fx-rate-sync', async () => {
    const startTime = Date.now();

    try {
      logger.info('[fx-rate-sync] Cron job starting');

      const result = await syncFxRates();
      const duration = Date.now() - startTime;

      logger.info('[fx-rate-sync] Cron job completed', {
        source: result.source,
        updated: result.updated.length,
        skipped: result.skipped.length,
        errors: result.errors.length,
        durationMs: duration,
      });

      return NextResponse.json({
        ...result,
        durationMs: duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('[fx-rate-sync] Cron job failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        durationMs: duration,
      });

      return NextResponse.json(
        {
          success: false,
          error:
            process.env.NODE_ENV === 'development'
              ? (error instanceof Error ? error.message : 'Internal server error')
              : 'Failed to sync exchange rates',
          durationMs: duration,
        },
        { status: 500 }
      );
    }
  });
}

// Allow POST for manual trigger
export async function POST(request: NextRequest) {
  return GET(request);
}
