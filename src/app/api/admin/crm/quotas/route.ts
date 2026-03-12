export const dynamic = 'force-dynamic';

/**
 * CRM Quotas API
 * GET  /api/admin/crm/quotas - List quotas with optional filters
 * POST /api/admin/crm/quotas - Create a new quota
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { prisma } from '@/lib/db';

const createQuotaSchema = z.object({
  agentId: z.string().min(1),
  period: z.enum(['daily', 'weekly', 'monthly', 'quarterly'], {
    errorMap: () => ({ message: 'Invalid period. Use: daily, weekly, monthly, quarterly' }),
  }),
  type: z.enum(['calls', 'revenue', 'deals', 'conversions'], {
    errorMap: () => ({ message: 'Invalid type. Use: calls, revenue, deals, conversions' }),
  }),
  target: z.number().min(0),
}).transform((data) => ({
  ...data,
  period: data.period.toLowerCase() as 'daily' | 'weekly' | 'monthly' | 'quarterly',
  type: data.type.toLowerCase() as 'calls' | 'revenue' | 'deals' | 'conversions',
}));

// ---------------------------------------------------------------------------
// GET: List quotas
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');
  const period = searchParams.get('period');
  const type = searchParams.get('type');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (agentId) where.agentId = agentId;
  if (period) where.period = period.toLowerCase();
  if (type) where.targetType = type.toLowerCase();

  const quotas = await prisma.crmQuota.findMany({
    where,
    include: {
      agent: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return apiSuccess(quotas, { request });
}, { requiredPermission: 'crm.reports.view' });

// ---------------------------------------------------------------------------
// POST: Create a quota
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = createQuotaSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Invalid data', 'VALIDATION_ERROR', {
      status: 400,
      details: parsed.error.errors,
      request,
    });
  }
  const { agentId, period: normalizedPeriod, type: normalizedType, target } = parsed.data;

  // Validate agent exists
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    select: { id: true },
  });
  if (!agent) {
    return apiError('Agent not found', 'RESOURCE_NOT_FOUND', { status: 404, request });
  }

  // Calculate period start/end
  const now = new Date();
  const periodStart = new Date(now);
  const periodEnd = new Date(now);

  switch (normalizedPeriod) {
    case 'daily':
      periodStart.setHours(0, 0, 0, 0);
      periodEnd.setHours(23, 59, 59, 999);
      break;
    case 'weekly':
      periodStart.setDate(now.getDate() - now.getDay());
      periodStart.setHours(0, 0, 0, 0);
      periodEnd.setDate(periodStart.getDate() + 6);
      periodEnd.setHours(23, 59, 59, 999);
      break;
    case 'monthly':
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd.setMonth(now.getMonth() + 1, 0);
      periodEnd.setHours(23, 59, 59, 999);
      break;
    case 'quarterly':
      {
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        periodStart.setMonth(quarterStart, 1);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd.setMonth(quarterStart + 3, 0);
        periodEnd.setHours(23, 59, 59, 999);
      }
      break;
  }

  const quota = await prisma.crmQuota.create({
    data: {
      agentId,
      period: normalizedPeriod,
      periodStart,
      periodEnd,
      targetType: normalizedType,
      target: Number(target),
      actual: 0,
    },
    include: {
      agent: {
        select: { name: true },
      },
    },
  });

  return apiSuccess(quota, { status: 201, request });
}, { requiredPermission: 'crm.reports.view' });
