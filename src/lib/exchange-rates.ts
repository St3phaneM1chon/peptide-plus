/**
 * Core logic: fetch live rates and update all active currencies in DB.
 * Shared between the cron GET handler and the admin refresh endpoint.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

interface ExchangeRateResponse {
  result: string;
  base_code: string;
  time_last_update_utc: string;
  time_next_update_utc: string;
  rates: Record<string, number>;
}

export async function updateExchangeRates(): Promise<{
  success: boolean;
  updated: Array<{ code: string; oldRate: number; newRate: number }>;
  skipped: string[];
  errors: string[];
  source: string;
  fetchedAt: string;
}> {
  const updated: Array<{ code: string; oldRate: number; newRate: number }> = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  // 1. Fetch all active currencies from DB (except default/CAD which is always 1.0)
  const currencies = await prisma.currency.findMany({
    where: { isActive: true },
  });

  if (currencies.length === 0) {
    logger.info('Exchange rates cron: no active currencies found in DB');
    return {
      success: true,
      updated: [],
      skipped: [],
      errors: [],
      source: 'open.er-api.com',
      fetchedAt: new Date().toISOString(),
    };
  }

  // 2. Fetch live rates from open.er-api.com (free, no API key)
  logger.info('Exchange rates cron: fetching live rates from open.er-api.com');

  const response = await fetch('https://open.er-api.com/v6/latest/CAD', {
    headers: { 'Accept': 'application/json' },
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Exchange rate API returned ${response.status}: ${errorText}`);
  }

  const data: ExchangeRateResponse = await response.json();

  if (data.result !== 'success') {
    throw new Error(`Exchange rate API returned result: ${data.result}`);
  }

  logger.info('Exchange rates cron: received rates from API', {
    rateCount: Object.keys(data.rates).length,
    lastUpdate: data.time_last_update_utc,
  });

  // 3. Update each currency in DB
  const now = new Date();

  for (const currency of currencies) {
    try {
      if (currency.isDefault || currency.code === 'CAD') {
        skipped.push(currency.code);
        continue;
      }

      const newRate = data.rates[currency.code];

      if (newRate === undefined) {
        logger.warn('Exchange rates cron: no rate found for currency', {
          currencyCode: currency.code,
        });
        errors.push(`${currency.code}: not found in API response`);
        continue;
      }

      const oldRate = Number(currency.exchangeRate);

      if (Math.abs(oldRate - newRate) < 0.000001) {
        skipped.push(currency.code);
        logger.debug('Exchange rates cron: rate unchanged', {
          currencyCode: currency.code,
          rate: oldRate,
        });
        continue;
      }

      await prisma.currency.update({
        where: { id: currency.id },
        data: {
          exchangeRate: newRate,
          rateUpdatedAt: now,
        },
      });

      updated.push({
        code: currency.code,
        oldRate,
        newRate,
      });

      logger.info('Exchange rates cron: rate updated', {
        currencyCode: currency.code,
        oldRate: oldRate.toFixed(6),
        newRate: newRate.toFixed(6),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Exchange rates cron: failed to update currency', {
        currencyCode: currency.code,
        error: msg,
      });
      errors.push(`${currency.code}: ${msg}`);
    }
  }

  return {
    success: true,
    updated,
    skipped,
    errors,
    source: 'open.er-api.com',
    fetchedAt: now.toISOString(),
  };
}
