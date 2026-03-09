export const dynamic = 'force-dynamic';

/**
 * CRM Attribution API
 * GET /api/admin/crm/attribution - Return attribution data by model
 *
 * Query params:
 *   model: 'first_touch' | 'last_touch' | 'multi_touch' (default: first_touch)
 *   startDate: ISO date string (default: 90 days ago)
 *   endDate: ISO date string (default: now)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';
import {
  calculateFirstTouchAttribution,
  calculateLastTouchAttribution,
  calculateMultiTouchAttribution,
} from '@/lib/crm/attribution';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const querySchema = z.object({
  model: z.enum(['first_touch', 'last_touch', 'multi_touch']).default('first_touch'),
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
});

// ---------------------------------------------------------------------------
// GET: Attribution data
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);

  const parseResult = querySchema.safeParse({
    model: searchParams.get('model') || 'first_touch',
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
  });

  if (!parseResult.success) {
    return apiError(
      'Invalid query parameters',
      ErrorCode.VALIDATION_ERROR,
      {
        status: 400,
        details: parseResult.error.flatten().fieldErrors,
        request,
      }
    );
  }

  const { model, startDate, endDate } = parseResult.data;

  // Default date range: last 90 days
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Validate date range
  if (start > end) {
    return apiError(
      'startDate must be before endDate',
      ErrorCode.VALIDATION_ERROR,
      { status: 400, request }
    );
  }

  try {
    const dateRange = { start, end };
    let data;

    switch (model) {
      case 'first_touch':
        data = await calculateFirstTouchAttribution(dateRange);
        break;
      case 'last_touch':
        data = await calculateLastTouchAttribution(dateRange);
        break;
      case 'multi_touch':
        data = await calculateMultiTouchAttribution(dateRange);
        break;
    }

    logger.info('Attribution data calculated', {
      model,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      resultCount: data.length,
    });

    return apiSuccess({
      model,
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      results: data,
      summary: {
        totalLeads: data.reduce((sum, r) => sum + r.leads, 0),
        totalDeals: data.reduce((sum, r) => sum + r.deals, 0),
        totalRevenue: Math.round(data.reduce((sum, r) => sum + r.revenue, 0) * 100) / 100,
        topSource: data.length > 0 ? data[0].source : null,
      },
    }, { request });
  } catch (error) {
    logger.error('Attribution calculation failed', {
      error: error instanceof Error ? error.message : String(error),
      model,
    });
    return apiError(
      'Failed to calculate attribution',
      ErrorCode.INTERNAL_ERROR,
      { status: 500, request }
    );
  }
}, { requiredPermission: 'crm.reports.view' });
