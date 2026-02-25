/**
 * Multi-Currency with Live FX Rates
 * Uses Bank of Canada / ECB as free data sources
 */

export interface FXRate {
  from: string;
  to: string;
  rate: number;
  timestamp: Date;
  source: string;
}

// Cached rates with 1-hour TTL
const rateCache = new Map<string, { rate: FXRate; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Fallback static rates (updated periodically)
const FALLBACK_RATES: Record<string, number> = {
  'USD/CAD': 1.36,
  'EUR/CAD': 1.47,
  'GBP/CAD': 1.72,
  'CAD/USD': 0.735,
  'CAD/EUR': 0.68,
  'CAD/GBP': 0.58,
};

export async function getExchangeRate(from: string, to: string): Promise<FXRate> {
  if (from === to) {
    return { from, to, rate: 1, timestamp: new Date(), source: 'identity' };
  }

  const cacheKey = `${from}/${to}`;
  const cached = rateCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.rate;
  }

  // Try live rate from Bank of Canada
  try {
    const response = await fetch(
      `https://www.bankofcanada.ca/valet/observations/FX${from}${to}/json?recent=1`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (response.ok) {
      const data = await response.json();
      const observations = data?.observations;
      if (observations && observations.length > 0) {
        const latest = observations[observations.length - 1];
        const rateKey = Object.keys(latest).find(k => k.startsWith('FX'));
        if (rateKey && latest[rateKey]?.v) {
          const rate: FXRate = {
            from,
            to,
            rate: parseFloat(latest[rateKey].v),
            timestamp: new Date(),
            source: 'bank_of_canada',
          };
          rateCache.set(cacheKey, { rate, expiresAt: Date.now() + CACHE_TTL_MS });
          return rate;
        }
      }
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback to static rates
  const fallbackRate = FALLBACK_RATES[cacheKey];
  if (fallbackRate) {
    return { from, to, rate: fallbackRate, timestamp: new Date(), source: 'fallback' };
  }

  // Try inverse
  const inverseKey = `${to}/${from}`;
  const inverseRate = FALLBACK_RATES[inverseKey];
  if (inverseRate) {
    return { from, to, rate: 1 / inverseRate, timestamp: new Date(), source: 'fallback_inverse' };
  }

  throw new Error(`No exchange rate available for ${from}/${to}`);
}

export function convertAmount(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}

export function calculateFXGainLoss(
  originalAmount: number,
  originalRate: number,
  currentRate: number
): { gainLoss: number; isGain: boolean } {
  const originalCAD = originalAmount * originalRate;
  const currentCAD = originalAmount * currentRate;
  const gainLoss = currentCAD - originalCAD;
  return { gainLoss: Math.round(gainLoss * 100) / 100, isGain: gainLoss >= 0 };
}
