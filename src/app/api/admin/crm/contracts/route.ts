export const dynamic = 'force-dynamic';

/**
 * CRM Contracts API (B20 - Contract Management)
 * GET  /api/admin/crm/contracts - List contracts with filters (status, upcoming renewals)
 * POST /api/admin/crm/contracts - Create a contract
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, apiPaginated } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createContractSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300).trim(),
  dealId: z.string().optional(),
  contactId: z.string().optional(),
  companyName: z.string().max(300).trim().optional(),
  status: z.enum(['DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'EXPIRED', 'RENEWED', 'CANCELLED', 'TERMINATED']).default('DRAFT'),
  startDate: z.string().datetime({ message: 'Valid start date is required' }),
  endDate: z.string().datetime({ message: 'Valid end date is required' }),
  value: z.number().min(0, 'Value must be non-negative'),
  currency: z.string().min(3).max(3).default('CAD'),
  renewalType: z.enum(['manual', 'auto', 'none']).default('manual'),
  renewalNoticeDays: z.number().int().min(0).max(365).default(30),
  terms: z.string().max(50000).optional(),
  documentUrl: z.string().url().optional(),
});

// ---------------------------------------------------------------------------
// GET: List contracts with filters
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  const status = searchParams.get('status');
  const upcomingRenewals = searchParams.get('upcomingRenewals');
  const search = searchParams.get('search');
  const dealId = searchParams.get('dealId');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (status) {
    where.status = status;
  }

  if (dealId) {
    where.dealId = dealId;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Filter contracts expiring within N days (default 30)
  if (upcomingRenewals === 'true') {
    const daysAhead = parseInt(searchParams.get('days') || '30', 10);
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    where.endDate = {
      gte: now,
      lte: futureDate,
    };
    where.status = { in: ['ACTIVE', 'PENDING_SIGNATURE'] };
  }

  const [contracts, total] = await Promise.all([
    prisma.crmContract.findMany({
      where,
      orderBy: { endDate: 'asc' },
      skip,
      take: limit,
    }),
    prisma.crmContract.count({ where }),
  ]);

  return apiPaginated(contracts, page, limit, total, { request });
}, { requiredPermission: 'crm.leads.view' });

// ---------------------------------------------------------------------------
// POST: Create a contract
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const body = await request.json();
  const parsed = createContractSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
      status: 400,
      details: parsed.error.flatten(),
      request,
    });
  }

  const data = parsed.data;

  // Validate end date is after start date
  if (new Date(data.endDate) <= new Date(data.startDate)) {
    return apiError('End date must be after start date', ErrorCode.VALIDATION_ERROR, {
      status: 400,
      request,
    });
  }

  // Verify deal exists if provided
  if (data.dealId) {
    const deal = await prisma.crmDeal.findUnique({
      where: { id: data.dealId },
      select: { id: true },
    });
    if (!deal) {
      return apiError('Deal not found', ErrorCode.NOT_FOUND, { status: 404, request });
    }
  }

  const contract = await prisma.crmContract.create({
    data: {
      title: data.title,
      dealId: data.dealId || null,
      contactId: data.contactId || null,
      companyName: data.companyName || null,
      status: data.status as 'DRAFT' | 'PENDING_SIGNATURE' | 'ACTIVE' | 'EXPIRED' | 'RENEWED' | 'CANCELLED' | 'TERMINATED',
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      value: data.value,
      currency: data.currency,
      renewalType: data.renewalType,
      renewalNoticeDays: data.renewalNoticeDays,
      terms: data.terms || null,
      documentUrl: data.documentUrl || null,
      createdById: session.user.id,
    },
  });

  logger.info('Contract created', {
    event: 'contract_created',
    contractId: contract.id,
    userId: session.user.id,
    dealId: data.dealId,
    value: data.value,
  });

  return apiSuccess(contract, { status: 201, request });
}, { requiredPermission: 'crm.leads.edit' });
