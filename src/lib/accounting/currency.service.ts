/**
 * Multi-Currency Service
 * Exchange rates, currency conversion, and FX gain/loss tracking
 */

interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  source: 'BOC' | 'BCE' | 'MANUAL';
  timestamp: Date;
}

interface CurrencyConfig {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  isBaseCurrency: boolean;
}

// Supported currencies
export const CURRENCIES: CurrencyConfig[] = [
  { code: 'CAD', name: 'Dollar canadien', symbol: '$', decimals: 2, isBaseCurrency: true },
  { code: 'USD', name: 'Dollar américain', symbol: '$', decimals: 2, isBaseCurrency: false },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2, isBaseCurrency: false },
  { code: 'GBP', name: 'Livre sterling', symbol: '£', decimals: 2, isBaseCurrency: false },
  { code: 'CHF', name: 'Franc suisse', symbol: 'CHF', decimals: 2, isBaseCurrency: false },
  { code: 'JPY', name: 'Yen japonais', symbol: '¥', decimals: 0, isBaseCurrency: false },
  { code: 'AUD', name: 'Dollar australien', symbol: 'A$', decimals: 2, isBaseCurrency: false },
  { code: 'MXN', name: 'Peso mexicain', symbol: '$', decimals: 2, isBaseCurrency: false },
];

// Cache for exchange rates
const rateCache = new Map<string, { rate: number; timestamp: Date }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * Fetch exchange rate from Bank of Canada API
 */
export async function fetchBOCRate(currency: string): Promise<number> {
  try {
    // Bank of Canada Valet API
    const response = await fetch(
      `https://www.bankofcanada.ca/valet/observations/FX${currency}CAD/json?recent=1`
    );
    
    if (!response.ok) {
      throw new Error('BOC API error');
    }

    const data = await response.json();
    const observations = data.observations;
    
    if (observations && observations.length > 0) {
      const latest = observations[observations.length - 1];
      const rateKey = `FX${currency}CAD`;
      return parseFloat(latest[rateKey]?.v || '1');
    }

    throw new Error('No rate data');
  } catch (error) {
    console.error(`Error fetching BOC rate for ${currency}:`, error);
    return getFallbackRate(currency);
  }
}

/**
 * Fallback exchange rates (updated periodically)
 */
function getFallbackRate(currency: string): number {
  const fallbackRates: Record<string, number> = {
    USD: 1.35,
    EUR: 1.47,
    GBP: 1.71,
    CHF: 1.52,
    JPY: 0.009,
    AUD: 0.89,
    MXN: 0.079,
    CAD: 1,
  };
  return fallbackRates[currency] || 1;
}

/**
 * Get exchange rate (with caching)
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string = 'CAD'
): Promise<ExchangeRate> {
  // Same currency
  if (fromCurrency === toCurrency) {
    return {
      fromCurrency,
      toCurrency,
      rate: 1,
      source: 'MANUAL',
      timestamp: new Date(),
    };
  }

  // Check cache
  const cacheKey = `${fromCurrency}-${toCurrency}`;
  const cached = rateCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp.getTime()) < CACHE_DURATION) {
    return {
      fromCurrency,
      toCurrency,
      rate: cached.rate,
      source: 'BOC',
      timestamp: cached.timestamp,
    };
  }

  // Fetch fresh rate
  let rate: number;
  
  if (toCurrency === 'CAD') {
    rate = await fetchBOCRate(fromCurrency);
  } else if (fromCurrency === 'CAD') {
    const inverseRate = await fetchBOCRate(toCurrency);
    rate = 1 / inverseRate;
  } else {
    // Cross rate through CAD
    const fromCAD = await fetchBOCRate(fromCurrency);
    const toCAD = await fetchBOCRate(toCurrency);
    rate = fromCAD / toCAD;
  }

  // Update cache
  const now = new Date();
  rateCache.set(cacheKey, { rate, timestamp: now });

  return {
    fromCurrency,
    toCurrency,
    rate,
    source: 'BOC',
    timestamp: now,
  };
}

/**
 * Convert amount between currencies
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rateOverride?: number
): Promise<{
  originalAmount: number;
  convertedAmount: number;
  rate: number;
  rateSource: string;
}> {
  const rate = rateOverride || (await getExchangeRate(fromCurrency, toCurrency)).rate;
  const convertedAmount = Math.round(amount * rate * 100) / 100;

  return {
    originalAmount: amount,
    convertedAmount,
    rate,
    rateSource: rateOverride ? 'MANUAL' : 'BOC',
  };
}

/**
 * Calculate FX gain/loss on settlement
 */
export function calculateFxGainLoss(
  originalAmount: number,
  _originalCurrency: string,
  originalRate: number,
  _settlementAmount: number,
  settlementRate: number
): {
  gainLoss: number;
  isGain: boolean;
  percentage: number;
} {
  // Original CAD value
  const originalCAD = originalAmount * originalRate;
  
  // Settlement CAD value
  const settlementCAD = originalAmount * settlementRate;
  
  // Gain/Loss
  const gainLoss = settlementCAD - originalCAD;
  
  return {
    gainLoss: Math.round(gainLoss * 100) / 100,
    isGain: gainLoss > 0,
    percentage: originalCAD !== 0 ? Math.round((gainLoss / originalCAD) * 10000) / 100 : 0,
  };
}

/**
 * Create FX gain/loss journal entry
 */
export function createFxJournalEntry(
  fxGainLoss: number,
  _reference: string,
  _description: string
): {
  lines: { accountCode: string; accountName: string; debit: number; credit: number }[];
} {
  const isGain = fxGainLoss > 0;
  const absAmount = Math.abs(fxGainLoss);

  return {
    lines: [
      {
        accountCode: isGain ? '1010' : '7000',
        accountName: isGain ? 'Compte bancaire' : 'Perte de change',
        debit: isGain ? absAmount : 0,
        credit: isGain ? 0 : absAmount,
      },
      {
        accountCode: isGain ? '7000' : '1010',
        accountName: isGain ? 'Gain de change' : 'Compte bancaire',
        debit: isGain ? 0 : absAmount,
        credit: isGain ? absAmount : 0,
      },
    ],
  };
}

/**
 * Format currency amount
 */
export function formatCurrency(
  amount: number,
  currencyCode: string = 'CAD',
  locale: string = 'fr-CA'
): string {
  const config = CURRENCIES.find(c => c.code === currencyCode);
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: config?.decimals ?? 2,
    maximumFractionDigits: config?.decimals ?? 2,
  }).format(amount);
}

/**
 * Get historical exchange rates for a period
 */
export async function getHistoricalRates(
  currency: string,
  startDate: Date,
  endDate: Date
): Promise<{ date: Date; rate: number }[]> {
  // In production, fetch from BOC historical API
  // For now, generate simulated historical data
  const rates: { date: Date; rate: number }[] = [];
  const baseRate = getFallbackRate(currency);
  
  const current = new Date(startDate);
  while (current <= endDate) {
    // Add some variation
    const variation = (Math.random() - 0.5) * 0.02;
    rates.push({
      date: new Date(current),
      rate: baseRate * (1 + variation),
    });
    current.setDate(current.getDate() + 1);
  }

  return rates;
}

/**
 * Revalue foreign currency accounts at period end
 */
export async function revalueForeignAccounts(
  accounts: {
    accountCode: string;
    accountName: string;
    currency: string;
    balance: number;
    originalRate: number;
  }[]
): Promise<{
  adjustments: {
    accountCode: string;
    accountName: string;
    originalCAD: number;
    currentCAD: number;
    adjustment: number;
  }[];
  totalAdjustment: number;
  journalEntry: {
    lines: { accountCode: string; accountName: string; debit: number; credit: number }[];
  };
}> {
  const adjustments: {
    accountCode: string;
    accountName: string;
    originalCAD: number;
    currentCAD: number;
    adjustment: number;
  }[] = [];

  let totalAdjustment = 0;

  for (const account of accounts) {
    if (account.currency === 'CAD') continue;

    const currentRate = (await getExchangeRate(account.currency, 'CAD')).rate;
    const originalCAD = account.balance * account.originalRate;
    const currentCAD = account.balance * currentRate;
    const adjustment = currentCAD - originalCAD;

    adjustments.push({
      accountCode: account.accountCode,
      accountName: account.accountName,
      originalCAD,
      currentCAD,
      adjustment,
    });

    totalAdjustment += adjustment;
  }

  // Create journal entry for adjustment
  const lines: { accountCode: string; accountName: string; debit: number; credit: number }[] = [];
  
  for (const adj of adjustments) {
    if (Math.abs(adj.adjustment) > 0.01) {
      lines.push({
        accountCode: adj.accountCode,
        accountName: adj.accountName,
        debit: adj.adjustment > 0 ? adj.adjustment : 0,
        credit: adj.adjustment < 0 ? Math.abs(adj.adjustment) : 0,
      });
    }
  }

  if (lines.length > 0) {
    lines.push({
      accountCode: totalAdjustment > 0 ? '7000' : '7000',
      accountName: totalAdjustment > 0 ? 'Gain de change non réalisé' : 'Perte de change non réalisée',
      debit: totalAdjustment < 0 ? Math.abs(totalAdjustment) : 0,
      credit: totalAdjustment > 0 ? totalAdjustment : 0,
    });
  }

  return {
    adjustments,
    totalAdjustment: Math.round(totalAdjustment * 100) / 100,
    journalEntry: { lines },
  };
}

/**
 * Get exchange rate history summary
 */
export function getExchangeRateSummary(
  rates: { date: Date; rate: number }[]
): {
  average: number;
  high: number;
  low: number;
  volatility: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
} {
  if (rates.length === 0) {
    return { average: 1, high: 1, low: 1, volatility: 0, trend: 'STABLE' };
  }

  const values = rates.map(r => r.rate);
  const average = values.reduce((a, b) => a + b, 0) / values.length;
  const high = Math.max(...values);
  const low = Math.min(...values);
  
  // Calculate volatility (standard deviation)
  const squaredDiffs = values.map(v => Math.pow(v - average, 2));
  const volatility = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);

  // Determine trend
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  
  const diff = secondAvg - firstAvg;
  const threshold = average * 0.02; // 2% threshold
  
  const trend = diff > threshold ? 'UP' : diff < -threshold ? 'DOWN' : 'STABLE';

  return {
    average: Math.round(average * 10000) / 10000,
    high: Math.round(high * 10000) / 10000,
    low: Math.round(low * 10000) / 10000,
    volatility: Math.round(volatility * 10000) / 10000,
    trend,
  };
}
