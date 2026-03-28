export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { z } from 'zod';
import { calculateCarrierRates, cleanExpiredRateCache } from '@/lib/shipping/rate-calculator';
import { logger } from '@/lib/logger';

const rateRequestSchema = z.object({
  originPostal: z.string().min(3).max(7),
  destPostal: z.string().min(3).max(7),
  weightGrams: z.number().min(1).max(30000),
  dimensions: z.object({
    lengthCm: z.number().min(1).max(200),
    widthCm: z.number().min(1).max(200),
    heightCm: z.number().min(1).max(200),
  }).optional(),
  carrier: z.enum(['canada_post', 'purolator', 'fedex', 'all']).optional(),
});

/**
 * GET /api/admin/carrier-rates?origin=H2X1Y4&dest=M5J2X2&weight=500
 * Quick rate lookup via query params
 */
export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const url = new URL(request.url);
    const origin = url.searchParams.get('origin') || '';
    const dest = url.searchParams.get('dest') || '';
    const weight = parseInt(url.searchParams.get('weight') || '0', 10);
    const carrier = (url.searchParams.get('carrier') || 'all') as 'canada_post' | 'purolator' | 'fedex' | 'all';

    if (!origin || !dest || weight <= 0) {
      return NextResponse.json({
        success: false,
        error: { message: 'Missing required params: origin, dest, weight' },
      }, { status: 400 });
    }

    const result = await calculateCarrierRates({
      originPostal: origin,
      destPostal: dest,
      weightGrams: weight,
      carrier,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logger.error('[CarrierRates] GET failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: { message: 'Failed to calculate rates' } }, { status: 500 });
  }
});

/**
 * POST /api/admin/carrier-rates
 * Calculate rates with full options (including dimensions)
 */
export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const data = rateRequestSchema.parse(body);

    const result = await calculateCarrierRates(data);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: { message: 'Validation error', details: error.errors } }, { status: 400 });
    }
    logger.error('[CarrierRates] POST failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: { message: 'Failed to calculate rates' } }, { status: 500 });
  }
});

/**
 * DELETE /api/admin/carrier-rates
 * Clean expired rate cache entries
 */
export const DELETE = withAdminGuard(async () => {
  try {
    const count = await cleanExpiredRateCache();
    return NextResponse.json({ success: true, cleaned: count });
  } catch (error) {
    logger.error('[CarrierRates] Cache cleanup failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: { message: 'Failed to clean cache' } }, { status: 500 });
  }
});
