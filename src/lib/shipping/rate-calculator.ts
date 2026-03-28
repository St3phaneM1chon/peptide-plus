/**
 * Carrier Rate Calculator — Multi-carrier shipping rate estimation
 *
 * Supports Canada Post, Purolator, FedEx rate estimation based on
 * weight, dimensions, and origin/destination postal codes.
 * Rates are cached for 5 minutes (TTL) to reduce API calls.
 *
 * Note: These are estimation algorithms. For live API rates,
 * integrate with actual carrier APIs (Canada Post REST, Purolator E-Ship, FedEx Rate API).
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CarrierRateRequest {
  originPostal: string;
  destPostal: string;
  weightGrams: number;
  dimensions?: {
    lengthCm: number;
    widthCm: number;
    heightCm: number;
  };
  carrier?: 'canada_post' | 'purolator' | 'fedex' | 'all';
}

export interface CarrierRateResult {
  carrier: string;
  service: string;
  rate: number;
  estimatedDays: string;
  currency: string;
}

export interface CarrierRateResponse {
  rates: CarrierRateResult[];
  cached: boolean;
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Canada Post zones by postal prefix distance
const CP_ZONE_MAP: Record<string, number> = {
  // Same province = zone 1
  SAME: 1,
  // Adjacent provinces = zone 2
  ADJACENT: 2,
  // Cross-country = zone 3-4
  DISTANT: 3,
  REMOTE: 4,
};

// Province mapping from postal prefix
const POSTAL_TO_PROVINCE: Record<string, string> = {
  A: 'NL', B: 'NS', C: 'PE', E: 'NB',
  G: 'QC', H: 'QC', J: 'QC',
  K: 'ON', L: 'ON', M: 'ON', N: 'ON', P: 'ON',
  R: 'MB', S: 'SK', T: 'AB',
  V: 'BC',
  X: 'NT', Y: 'YT',
};

// Adjacent provinces
const ADJACENT_PROVINCES: Record<string, string[]> = {
  NL: ['NS', 'NB', 'PE'],
  NS: ['NL', 'NB', 'PE'],
  PE: ['NL', 'NS', 'NB'],
  NB: ['NL', 'NS', 'PE', 'QC'],
  QC: ['NB', 'ON'],
  ON: ['QC', 'MB'],
  MB: ['ON', 'SK'],
  SK: ['MB', 'AB'],
  AB: ['SK', 'BC'],
  BC: ['AB', 'YT'],
  NT: ['YT', 'AB', 'SK', 'BC'],
  YT: ['BC', 'NT'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getProvince(postalCode: string): string {
  const prefix = postalCode.trim().toUpperCase().charAt(0);
  return POSTAL_TO_PROVINCE[prefix] || 'ON'; // default Ontario
}

function getZone(originPostal: string, destPostal: string): number {
  const originProv = getProvince(originPostal);
  const destProv = getProvince(destPostal);

  if (originProv === destProv) return CP_ZONE_MAP.SAME;
  if (ADJACENT_PROVINCES[originProv]?.includes(destProv)) return CP_ZONE_MAP.ADJACENT;

  // Northern territories are always remote
  if (['NT', 'YT'].includes(destProv)) return CP_ZONE_MAP.REMOTE;

  return CP_ZONE_MAP.DISTANT;
}

function getDimensionalWeight(dims: { lengthCm: number; widthCm: number; heightCm: number }): number {
  // DIM factor: L x W x H / 5000 = kg
  return (dims.lengthCm * dims.widthCm * dims.heightCm) / 5000;
}

function getBillableWeight(weightGrams: number, dims?: { lengthCm: number; widthCm: number; heightCm: number }): number {
  const actualKg = weightGrams / 1000;
  if (!dims) return actualKg;
  const dimKg = getDimensionalWeight(dims);
  return Math.max(actualKg, dimKg);
}

// ---------------------------------------------------------------------------
// Canada Post Rate Estimation
// ---------------------------------------------------------------------------

function estimateCanadaPost(req: CarrierRateRequest): CarrierRateResult[] {
  const zone = getZone(req.originPostal, req.destPostal);
  const billableKg = getBillableWeight(req.weightGrams, req.dimensions);
  const results: CarrierRateResult[] = [];

  // Base rates per zone per kg (approximate 2026 rates)
  const zoneRates: Record<number, { regular: number; expedited: number; priority: number; xpresspost: number }> = {
    1: { regular: 10.99, expedited: 13.49, xpresspost: 16.99, priority: 26.99 },
    2: { regular: 13.99, expedited: 16.49, xpresspost: 20.99, priority: 31.99 },
    3: { regular: 16.99, expedited: 19.99, xpresspost: 25.99, priority: 38.99 },
    4: { regular: 22.99, expedited: 27.99, xpresspost: 35.99, priority: 52.99 },
  };

  const rates = zoneRates[zone] || zoneRates[3];
  const weightMultiplier = Math.max(1, billableKg);
  const fuelSurcharge = 1.1275; // ~12.75% fuel surcharge

  // Regular Parcel
  results.push({
    carrier: 'Canada Post',
    service: 'Regular Parcel',
    rate: Math.round(rates.regular * weightMultiplier * fuelSurcharge * 100) / 100,
    estimatedDays: zone <= 2 ? '4-8 business days' : '7-12 business days',
    currency: 'CAD',
  });

  // Expedited Parcel
  results.push({
    carrier: 'Canada Post',
    service: 'Expedited Parcel',
    rate: Math.round(rates.expedited * weightMultiplier * fuelSurcharge * 100) / 100,
    estimatedDays: zone <= 2 ? '2-4 business days' : '4-7 business days',
    currency: 'CAD',
  });

  // Xpresspost
  results.push({
    carrier: 'Canada Post',
    service: 'Xpresspost',
    rate: Math.round(rates.xpresspost * weightMultiplier * fuelSurcharge * 100) / 100,
    estimatedDays: zone <= 2 ? '1-2 business days' : '2-3 business days',
    currency: 'CAD',
  });

  // Priority (only for < 30kg)
  if (billableKg <= 30) {
    results.push({
      carrier: 'Canada Post',
      service: 'Priority',
      rate: Math.round(rates.priority * weightMultiplier * fuelSurcharge * 100) / 100,
      estimatedDays: '1-2 business days',
      currency: 'CAD',
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Purolator Rate Estimation
// ---------------------------------------------------------------------------

function estimatePurolator(req: CarrierRateRequest): CarrierRateResult[] {
  const zone = getZone(req.originPostal, req.destPostal);
  const billableKg = getBillableWeight(req.weightGrams, req.dimensions);
  const results: CarrierRateResult[] = [];

  // Purolator tends to be slightly more expensive but faster
  const baseRates: Record<number, { ground: number; express: number; express9: number }> = {
    1: { ground: 12.99, express: 18.49, express9: 28.99 },
    2: { ground: 15.99, express: 22.49, express9: 34.99 },
    3: { ground: 19.99, express: 27.99, express9: 42.99 },
    4: { ground: 25.99, express: 35.99, express9: 55.99 },
  };

  const rates = baseRates[zone] || baseRates[3];
  const weightMultiplier = Math.max(1, billableKg);
  const fuelSurcharge = 1.155; // ~15.5% fuel surcharge

  // Ground
  results.push({
    carrier: 'Purolator',
    service: 'Ground',
    rate: Math.round(rates.ground * weightMultiplier * fuelSurcharge * 100) / 100,
    estimatedDays: zone <= 2 ? '3-5 business days' : '5-8 business days',
    currency: 'CAD',
  });

  // Express
  results.push({
    carrier: 'Purolator',
    service: 'Express',
    rate: Math.round(rates.express * weightMultiplier * fuelSurcharge * 100) / 100,
    estimatedDays: zone <= 2 ? '1-2 business days' : '2-3 business days',
    currency: 'CAD',
  });

  // Express 9AM (only zone 1-2)
  if (zone <= 2) {
    results.push({
      carrier: 'Purolator',
      service: 'Express 9AM',
      rate: Math.round(rates.express9 * weightMultiplier * fuelSurcharge * 100) / 100,
      estimatedDays: 'Next business day by 9AM',
      currency: 'CAD',
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// FedEx Rate Estimation
// ---------------------------------------------------------------------------

function estimateFedEx(req: CarrierRateRequest): CarrierRateResult[] {
  const zone = getZone(req.originPostal, req.destPostal);
  const billableKg = getBillableWeight(req.weightGrams, req.dimensions);
  const results: CarrierRateResult[] = [];

  const baseRates: Record<number, { ground: number; express: number; priority: number }> = {
    1: { ground: 14.49, express: 21.99, priority: 34.99 },
    2: { ground: 17.49, express: 25.99, priority: 39.99 },
    3: { ground: 21.49, express: 31.99, priority: 47.99 },
    4: { ground: 28.49, express: 39.99, priority: 59.99 },
  };

  const rates = baseRates[zone] || baseRates[3];
  const weightMultiplier = Math.max(1, billableKg);
  const fuelSurcharge = 1.17; // ~17% fuel surcharge

  // FedEx Ground
  results.push({
    carrier: 'FedEx',
    service: 'Ground',
    rate: Math.round(rates.ground * weightMultiplier * fuelSurcharge * 100) / 100,
    estimatedDays: zone <= 2 ? '3-5 business days' : '5-7 business days',
    currency: 'CAD',
  });

  // FedEx Express Saver
  results.push({
    carrier: 'FedEx',
    service: 'Express Saver',
    rate: Math.round(rates.express * weightMultiplier * fuelSurcharge * 100) / 100,
    estimatedDays: zone <= 2 ? '2-3 business days' : '3-4 business days',
    currency: 'CAD',
  });

  // FedEx Priority Overnight (only reasonable distances)
  if (zone <= 3) {
    results.push({
      carrier: 'FedEx',
      service: 'Priority Overnight',
      rate: Math.round(rates.priority * weightMultiplier * fuelSurcharge * 100) / 100,
      estimatedDays: 'Next business day',
      currency: 'CAD',
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Main Calculator (with caching)
// ---------------------------------------------------------------------------

/**
 * Calculate shipping rates from multiple carriers.
 * Results are cached in the database for 5 minutes.
 */
export async function calculateCarrierRates(req: CarrierRateRequest): Promise<CarrierRateResponse> {
  const carrier = req.carrier || 'all';
  const originClean = req.originPostal.replace(/\s/g, '').toUpperCase();
  const destClean = req.destPostal.replace(/\s/g, '').toUpperCase();

  // Check cache first
  try {
    const cached = await prisma.carrierRateCache.findFirst({
      where: {
        carrier: carrier,
        originPostal: originClean,
        destPostal: destClean,
        weightGrams: req.weightGrams,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (cached) {
      return {
        rates: cached.rates as CarrierRateResult[],
        cached: true,
        expiresAt: cached.expiresAt.toISOString(),
      };
    }
  } catch (e) {
    logger.warn('[CarrierRates] Cache lookup failed, computing fresh rates', { error: e instanceof Error ? e.message : String(e) });
  }

  // Calculate rates
  let rates: CarrierRateResult[] = [];
  const requestNormalized = { ...req, originPostal: originClean, destPostal: destClean };

  switch (carrier) {
    case 'canada_post':
      rates = estimateCanadaPost(requestNormalized);
      break;
    case 'purolator':
      rates = estimatePurolator(requestNormalized);
      break;
    case 'fedex':
      rates = estimateFedEx(requestNormalized);
      break;
    case 'all':
    default:
      rates = [
        ...estimateCanadaPost(requestNormalized),
        ...estimatePurolator(requestNormalized),
        ...estimateFedEx(requestNormalized),
      ];
      break;
  }

  // Sort by rate ascending
  rates.sort((a, b) => a.rate - b.rate);

  const expiresAt = new Date(Date.now() + CACHE_TTL_MS);

  // Cache the result (fire-and-forget)
  prisma.carrierRateCache.create({
    data: {
      carrier,
      originPostal: originClean,
      destPostal: destClean,
      weightGrams: req.weightGrams,
      lengthCm: req.dimensions?.lengthCm,
      widthCm: req.dimensions?.widthCm,
      heightCm: req.dimensions?.heightCm,
      rates: rates as unknown as Parameters<typeof prisma.carrierRateCache.create>[0]['data']['rates'],
      expiresAt,
    },
  }).catch((e) => {
    logger.warn('[CarrierRates] Failed to cache rates', { error: e instanceof Error ? e.message : String(e) });
  });

  return {
    rates,
    cached: false,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Get the cheapest rate for a given shipment (convenience helper).
 */
export async function getCheapestRate(req: CarrierRateRequest): Promise<CarrierRateResult | null> {
  const response = await calculateCarrierRates({ ...req, carrier: 'all' });
  return response.rates.length > 0 ? response.rates[0] : null;
}

/**
 * Clean expired cache entries (called by cron or maintenance).
 */
export async function cleanExpiredRateCache(): Promise<number> {
  const result = await prisma.carrierRateCache.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
