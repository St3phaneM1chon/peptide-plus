export const dynamic = 'force-dynamic';

/**
 * CRM Quotas API
 * GET  /api/admin/crm/quotas - List quotas with optional filters
 * POST /api/admin/crm/quotas - Create a new quota
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { prisma } from '@/lib/db';

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
  const { agentId, period, type, target } = body;

  if (!agentId || !period || !type || target === undefined) {
    return apiError('Missing required fields: agentId, period, type, target', 'VALIDATION_ERROR', {
      status: 400,
      request,
    });
  }

  // Validate period
  const validPeriods = ['daily', 'weekly', 'monthly', 'quarterly'];
  const normalizedPeriod = String(period).toLowerCase();
  if (!validPeriods.includes(normalizedPeriod)) {
    return apiError(`Invalid period. Use: ${validPeriods.join(', ')}`, 'VALIDATION_ERROR', {
      status: 400,
      request,
    });
  }

  // Validate type
  const validTypes = ['calls', 'revenue', 'deals', 'conversions'];
  const normalizedType = String(type).toLowerCase();
  if (!validTypes.includes(normalizedType)) {
    return apiError(`Invalid type. Use: ${validTypes.join(', ')}`, 'VALIDATION_ERROR', {
      status: 400,
      request,
    });
  }

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
