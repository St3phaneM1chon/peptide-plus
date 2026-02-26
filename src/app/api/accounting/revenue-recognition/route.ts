export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import {
  listRevenueSchedules,
  createRevenueSchedule,
  getDeferredRevenueBalance,
  getRevenueByType,
} from '@/lib/accounting/revenue-recognition.service';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const createScheduleSchema = z.object({
  orderId: z.string().min(1, 'orderId est requis'),
  items: z.array(z.object({
    description: z.string().min(1),
    amount: z.number().positive('Le montant doit être positif'),
    recognitionMethod: z.enum(['POINT_OF_SALE', 'STRAIGHT_LINE', 'MILESTONE']).optional(),
    periodMonths: z.number().int().min(1).max(120).optional(),
    milestones: z.array(z.object({
      date: z.string().min(1),
      percentage: z.number().min(0).max(100),
    })).optional(),
  })).min(1, 'Au moins un article est requis'),
  recognitionMethod: z.enum(['POINT_OF_SALE', 'STRAIGHT_LINE', 'MILESTONE']),
  startDate: z.string().optional(),
});

/**
 * GET /api/accounting/revenue-recognition
 * List revenue schedules with optional filters
 *
 * Query params:
 *   - status: ACTIVE | COMPLETED | CANCELLED
 *   - page: number (default 1)
 *   - limit: number (default 50, max 200)
 *   - action: 'balance' | 'by-type' (special aggregation endpoints)
 *   - asOfDate: ISO date string (for balance query)
 *   - dateFrom / dateTo: ISO date strings (for by-type query)
 */
export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Special action: deferred revenue balance
    if (action === 'balance') {
      const asOfDateStr = searchParams.get('asOfDate');
      const asOfDate = asOfDateStr ? new Date(asOfDateStr) : new Date();
      if (isNaN(asOfDate.getTime())) {
        return NextResponse.json({ error: 'Format de date invalide pour asOfDate' }, { status: 400 });
      }
      const balance = await getDeferredRevenueBalance(asOfDate);
      return NextResponse.json(balance);
    }

    // Special action: revenue by type
    if (action === 'by-type') {
      const dateFromStr = searchParams.get('dateFrom');
      const dateToStr = searchParams.get('dateTo');
      if (!dateFromStr || !dateToStr) {
        return NextResponse.json({ error: 'dateFrom et dateTo sont requis pour action=by-type' }, { status: 400 });
      }
      const dateFrom = new Date(dateFromStr);
      const dateTo = new Date(dateToStr);
      if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) {
        return NextResponse.json({ error: 'Format de date invalide' }, { status: 400 });
      }
      if (dateFrom >= dateTo) {
        return NextResponse.json({ error: 'dateFrom doit être antérieure à dateTo' }, { status: 400 });
      }
      const breakdown = await getRevenueByType(dateFrom, dateTo);
      return NextResponse.json(breakdown);
    }

    // Default: list schedules
    const status = searchParams.get('status') as 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | null;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50')), 200);

    const result = await listRevenueSchedules({
      status: status || undefined,
      page,
      limit,
    });

    return NextResponse.json({
      schedules: result.schedules,
      total: result.total,
      page,
      limit,
    });
  } catch (error) {
    logger.error('Revenue recognition GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des schedules de revenus' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/accounting/revenue-recognition
 * Create a new revenue schedule manually
 */
export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/revenue-recognition');
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
    const parsed = createScheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.errors }, { status: 400 });
    }

    const { orderId, items, recognitionMethod, startDate } = parsed.data;
    const effectiveStartDate = startDate ? new Date(startDate) : undefined;

    if (effectiveStartDate && isNaN(effectiveStartDate.getTime())) {
      return NextResponse.json({ error: 'Format de date de début invalide' }, { status: 400 });
    }

    // Map items to ensure recognitionMethod is set on each item (default to top-level method)
    const mappedItems = items.map(item => ({
      ...item,
      recognitionMethod: item.recognitionMethod || recognitionMethod,
    }));

    const result = await createRevenueSchedule(orderId, mappedItems, recognitionMethod, effectiveStartDate);

    return NextResponse.json({
      success: true,
      scheduleReference: result.scheduleReference,
      entriesCreated: result.entriesCreated,
    }, { status: 201 });
  } catch (error) {
    logger.error('Revenue recognition POST error', { error: error instanceof Error ? error.message : String(error) });

    // Handle known business errors
    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json(
      { error: 'Erreur lors de la création du schedule de revenus' },
      { status: 500 }
    );
  }
});
